export const accounts = {
  client: { email: "karim@demo.com", password: "demo1234", name: "Karim Ben Salah" },
  client2: { email: "sarah@demo.com", password: "demo1234", name: "Sarah Mansouri" },
  merchantFlore: { email: "flore@demo.com", password: "demo1234", name: "Café Flore" },
  merchantBistrot: { email: "bistrot@demo.com", password: "demo1234", name: "Le Bistrot" },
  merchantSushi: { email: "sushi@demo.com", password: "demo1234", name: "Sushi Palace" },
  admin: { email: "admin@demo.com", password: "demo1234", name: "Admin Taprivo" },
} as const;

export type Account = (typeof accounts)[keyof typeof accounts];
