"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
}

export const AVAILABLE_USERS: SessionUser[] = [
  { id: "demo-user-1", username: "viajante_porto", email: "demo@tripbook.pt" },
  { id: "demo-user-2", username: "ana_exploradora", email: "ana@tripbook.pt" },
];

interface UserSessionBarProps {
  currentUser: SessionUser;
  availableUsers: SessionUser[];
  onSelectUser: (user: SessionUser) => void;
}

export default function UserSessionBar({
  currentUser,
  availableUsers,
  onSelectUser,
}: UserSessionBarProps) {
  return (
    <Card className="border-slate-800 bg-slate-900 text-white">
      <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            {currentUser.username[0]?.toUpperCase() || "U"}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Signed in as</span>
              <span className="text-sm font-semibold text-slate-100">
                @{currentUser.username}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-400">
              {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="mr-1 text-xs text-slate-400">Switch user:</span>
          {availableUsers.map((user) => (
            <Button
              key={user.id}
              size="sm"
              variant={currentUser.id === user.id ? "default" : "secondary"}
              onClick={() => onSelectUser(user)}
              className="h-7 text-xs"
            >
              @{user.username}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
