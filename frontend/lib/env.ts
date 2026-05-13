type Env = {
  API_URL: string;
};

export const env: Env = {
  API_URL:
    process.env.NEXT_PUBLIC_API_URL || "https://vendeoia-api.fadevt.org",
};
