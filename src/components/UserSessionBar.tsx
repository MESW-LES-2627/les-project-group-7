export interface SessionUser {
  id: string;
  username: string;
  email: string;
}

export const AVAILABLE_USERS: SessionUser[] = [
  { id: "demo-user-1", username: "viajante_porto", email: "demo@tripbook.pt" },
  { id: "demo-user-2", username: "ana_exploradora", email: "ana@tripbook.pt" },
];
