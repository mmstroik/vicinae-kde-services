import { ActionPanel, Action, List, LaunchProps } from '@vicinae/api';
import React, { useState, useEffect } from 'react';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface KCMModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  execCommand: string;
}

function parseDesktopFile(filePath: string): KCMModule | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let name = '';
    let description = '';
    let icon = '';
    let keywords: string[] = [];
    let moduleId = '';
    let execCommand = '';

    for (const line of lines) {
      if (line.startsWith('Name=') && !line.includes('[')) {
        name = line.substring(5).trim();
      }
      else if (line.startsWith('Comment=') && !line.includes('[')) {
        description = line.substring(8).trim();
      }
      else if (line.startsWith('Icon=')) {
        icon = line.substring(5).trim();
      }
      else if (line.startsWith('X-KDE-Keywords=') && !line.includes('[')) {
        const keywordStr = line.substring(15).trim();
        keywords = keywordStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
      }
      else if (line.startsWith('X-KDE-Library=')) {
        moduleId = line.substring(14).trim();
      }
      else if (line.startsWith('Exec=')) {
        execCommand = line.substring(5).trim();
      }
    }

    if (!name) return null;

    let finalModuleId = '';
    let finalCommand = '';

    if (execCommand.includes('systemsettings')) {
      // modern KDE6: "systemsettings kcm_modulename"
      const parts = execCommand.split(/\s+/);
      if (parts.length > 1 && parts[1]) {
        finalModuleId = parts[1];
        finalCommand = execCommand;
      }
    } else if (moduleId) {
      // legacy KDE5: uses X-KDE-Library
      finalModuleId = moduleId;
      finalCommand = `kcmshell6 ${moduleId}`;
    }

    if (!finalModuleId) return null;

    return {
      id: finalModuleId,
      name,
      description: description || name,
      icon: icon || 'preferences-system',
      keywords,
      execCommand: finalCommand,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

function loadKCMModules(): KCMModule[] {
  const modules: KCMModule[] = [];
  const seen = new Set<string>();

  // KDE6 location
  const applicationsDir = '/usr/share/applications';
  if (existsSync(applicationsDir)) {
    try {
      const files = readdirSync(applicationsDir);
      for (const file of files) {
        if (file.startsWith('kcm_') && file.endsWith('.desktop')) {
          const filePath = join(applicationsDir, file);
          const module = parseDesktopFile(filePath);
          if (module && !seen.has(module.id)) {
            modules.push(module);
            seen.add(module.id);
          }
        }
      }
    } catch (error) {
      console.error('Error reading applications directory:', error);
    }
  }

  // KDE5 location
  const kservices5Dir = '/usr/share/kservices5';
  if (existsSync(kservices5Dir)) {
    try {
      const files = readdirSync(kservices5Dir);
      for (const file of files) {
        if (file.endsWith('.desktop')) {
          const filePath = join(kservices5Dir, file);
          const module = parseDesktopFile(filePath);
          if (module && !seen.has(module.id)) {
            modules.push(module);
            seen.add(module.id);
          }
        }
      }
    } catch (error) {
      console.error('Error reading kservices5 directory:', error);
    }
  }

  modules.sort((a, b) => a.name.localeCompare(b.name));

  return modules;
}

async function openKCMModule(command: string) {
  try {
    await execAsync(command);
  } catch (error) {
    console.error('Error opening module:', error);
  }
}

export default function SearchSettings(props: LaunchProps) {
  const [modules, setModules] = useState<KCMModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState(props.fallbackText || '');

  useEffect(() => {
    const loadedModules = loadKCMModules();
    setModules(loadedModules);
    setIsLoading(false);
  }, []);

  const filteredModules = modules.filter((module: KCMModule) => {
    if (!searchText) return true;

    const search = searchText.toLowerCase();
    const matchesName = module.name.toLowerCase().includes(search);
    const matchesDescription = module.description.toLowerCase().includes(search);
    const matchesKeywords = module.keywords.some((keyword: string) => keyword.toLowerCase().includes(search));

    return matchesName || matchesDescription || matchesKeywords;
  });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search KDE System Settings..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      {filteredModules.map((module: KCMModule) => (
        <List.Item
          key={module.id}
          title={module.name}
          subtitle={module.description !== module.name ? module.description : ''}
          icon={module.icon}
          keywords={module.keywords}
          actions={
            <ActionPanel>
              <Action
                title="Open Settings Module"
                onAction={() => openKCMModule(module.execCommand)}
              />
              <Action.CopyToClipboard
                title="Copy Module ID"
                content={module.id}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
