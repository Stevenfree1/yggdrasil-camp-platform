export const logger = {
  info: (...args: unknown[]) => console.log('[INFO]', new Date().toISOString(), ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  /** Log security-relevant events (failed logins, permission denials, suspicious activity) */
  security: (...args: unknown[]) => console.warn('[SECURITY]', new Date().toISOString(), ...args),
};

export default logger;