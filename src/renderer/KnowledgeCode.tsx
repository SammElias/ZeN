import React, {memo} from 'react';
import hljs from 'highlight.js/lib/core';
import powershell from 'highlight.js/lib/languages/powershell';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';

for (const [language, definition] of Object.entries({powershell, bash, python, csharp, javascript, typescript, sql, json, yaml})) {
  hljs.registerLanguage(language, definition);
}
hljs.registerAliases(['azure-cli', 'az'], {languageName: 'bash'});
hljs.registerAliases(['c#'], {languageName: 'csharp'});

export const KnowledgeCode = memo(function KnowledgeCode({text, language}: {text: string; language: string}) {
  const name = language.toLowerCase().replaceAll(' ', '-');
  if (!hljs.getLanguage(name) || text.length > 30_000) return <code>{text}</code>;
  const highlighted = hljs.highlight(text, {language: name, ignoreIllegals: true});
  // highlight.js escapes source text and emits only its own token spans.
  return <code className="hub-highlight" dangerouslySetInnerHTML={{__html: highlighted.value}}/>;
});
