import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type {PR} from './types';
export default function Description({p}:{p:PR}){
 const sourceRoot=`https://github.com/${p.headRepo||p.repo}/blob/${p.headSha}/`;
 return <div className="markdown-description"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex,{strict:false,throwOnError:false,trust:false,maxSize:20,maxExpand:1000}]]} skipHtml components={{
  a:({href,children})=><a href={!href?p.url:href.startsWith('#')?p.url+href:/^[a-z]+:/i.test(href)?href:sourceRoot+href} target="_blank" rel="noreferrer">{children}</a>,
  img:({src,alt,title})=><img src={src} alt={alt} title={title} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
 }}>{p.body}</Markdown></div>;
}
