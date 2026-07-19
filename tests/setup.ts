Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_NAME ??= "Scarlet Satellite Blog";
process.env.APP_URL ??= "http://localhost:3000";
process.env.APP_DOMAIN ??= "localhost";
process.env.TRUSTED_HOSTS ??= "localhost,127.0.0.1";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.REDIS_PASSWORD ??= "test-redis-password-with-entropy";
process.env.AUTH_SECRET =
  "test-auth-secret-with-at-least-thirty-two-characters";
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.INITIAL_ADMIN_USERNAME = "admin";
process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
process.env.INITIAL_ADMIN_PASSWORD = "correct horse battery staple";
process.env.SMTP_PORT = "587";
process.env.UPLOAD_STORAGE_DRIVER = "local";
process.env.UPLOAD_LOCAL_PATH = "/tmp/uploads";
process.env.CERTBOT_EMAIL = "admin@example.com";
