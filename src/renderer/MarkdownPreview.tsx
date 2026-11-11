import React, {lazy, Suspense} from 'react';

type MarkdownProps = {
  text: string; className: string; open?: (url: string) => void;
  renderCode?: (text: string, language: string) => React.ReactNode;
};

function PlainText({text, className}: MarkdownProps) {
  return <div className={className} style={{whiteSpace: 'pre-wrap'}}>{text}</div>;
}

const FormattedText = lazy<React.ComponentType<MarkdownProps>>(() => import('./message-text').then(
  module => ({default: module.MarkdownText}),
  () => ({default: PlainText}),
));

export function MarkdownPreview(props: MarkdownProps) {
  return <Suspense fallback={<PlainText {...props}/>}>
    <FormattedText {...props}/>
  </Suspense>;
}
