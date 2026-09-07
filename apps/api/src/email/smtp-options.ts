export function smtpTransportOptions(config: {
  host: string;
  port: number;
  secure?: boolean | null;
  user?: string;
  pass?: string;
}) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    ...(config.user ? { auth: { user: config.user, pass: config.pass } } : {}),
  };
}
