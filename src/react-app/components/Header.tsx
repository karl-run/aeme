import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";

import { useLogoutMutation, useSessionQuery } from "../queries/session.ts";
import { AddActivityDialog } from "./AddActivityDialog.tsx";
import { PageContainer } from "./PageContainer.tsx";
import { Button } from "./ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";

export const Header = () => {
  const { data, isPending } = useSessionQuery();
  const logout = useLogoutMutation();

  const session = data?.session;

  return (
    <header className="border-b border-zinc-700">
      <PageContainer className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="font-semibold">
          æme
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          {isPending ? (
            <span className="h-4 w-40 animate-pulse rounded bg-zinc-700" />
          ) : (
            <>
              {!session && <span>Not logged in</span>}
              {session && (
                <>
                  <AddActivityDialog />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="sm">
                          {session.userName}
                          <ChevronDownIcon className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        #{session.channelName}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuLinkItem render={<Link to="/profile" />}>
                        Profile
                      </DropdownMenuLinkItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </header>
  );
};
