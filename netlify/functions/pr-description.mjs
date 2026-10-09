import research from './research.mjs';
// Normalize the route even when Netlify invokes the function by its internal URL.
export default function description(request){
 const url=new URL(request.url);url.pathname='/api/pr-description';
 return research(new Request(url,{method:request.method,headers:request.headers,signal:request.signal}));
}
export const config={path:'/api/pr-description'};
