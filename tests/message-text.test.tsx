import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {MessageText} from '../src/renderer/message-text';
const render=(text:string)=>renderToStaticMarkup(<MessageText text={text} notify={()=>{}}/>);
describe('safe rich message presentation',()=>{
  it('renders quotes and rich text while keeping code literal',()=>{
    const html=render('> Una **cita**\n\n1. Primer paso\n2. Segundo paso\n\n```text\n> literal <script> **código**\n```');
    expect(html).toContain('<blockquote>');expect(html).toContain('<strong>cita</strong>');expect(html).toContain('<ol>');
    expect(html).toContain('&gt; literal &lt;script&gt; **código**');expect(html).not.toContain('<script>');
  });
  it('does not render raw HTML, executable links or fetch remote images',()=>{
    const html=render('<script>alert(1)</script>\n\n[ejecutar](javascript:alert)\n\n![remota](https://example.com/pixel.png)\n\n[archivo](file:///C:/secreto.txt)');
    expect(html).not.toContain('<script');expect(html).not.toContain('<img');expect(html).not.toContain('javascript:');expect(html).not.toContain('file:///');
    expect(html).toContain('Ver imagen: remota');
  });
  it('gives tables their own scroll surface and routes web links through existing actions',()=>{
    const html=render('| A | B |\n|---|---|\n| valor | otro |\n\n[Fuente](https://example.com/docs)');
    expect(html).toContain('aria-label="Tabla desplazable"');expect(html).toContain('<table>');expect(html).toContain('title="https://example.com/docs"');expect(html).not.toContain('href=');
  });
});
