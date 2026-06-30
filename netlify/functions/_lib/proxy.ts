// Always-on residential proxy config. Rotating endpoint — NO sticky / session
// affinity (hard project rule: never pin an exit IP). Each request may exit from
// a different residential IP.

export interface ProxyConfig {
  server: string; // http://host:port  (NO credentials — those go via page.authenticate)
  username: string;
  password: string;
}

export function residentialProxy(): ProxyConfig | null {
  const host = process.env.PROXY_HOST;
  const username = process.env.PROXY_USERNAME;
  const password = process.env.PROXY_PASSWORD;
  if (!host || !username || !password) return null;

  const port = Number(process.env.PROXY_PORT ?? 823); // 823 = plain rotating residential
  return { server: `http://${host}:${port}`, username, password };
}
