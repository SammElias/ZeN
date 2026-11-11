import { join } from 'node:path';
import helpers from '../../config/native-helpers.json';

export function nativeHelper(directory: string, key: keyof typeof helpers) {
  const { output, project } = helpers[key];
  return join(directory, output, project + '.exe');
}

export const hookExecutableName = helpers.hook.project + '.exe';
export const hookArtifactNames = [hookExecutableName,
  ...['.dll', '.deps.json', '.runtimeconfig.json'].map(extension => helpers.hook.project + extension),
];
