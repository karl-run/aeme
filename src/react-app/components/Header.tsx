import { Link } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  useLogoutMutation,
  useSessionChannelsQuery,
  useSessionQuery,
  useSwitchChannelMutation,
} from "../queries/session.ts";
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
  const { data: channels } = useSessionChannelsQuery();
  const switchChannel = useSwitchChannelMutation();

  const session = data?.session;

  return (
    <header className="border-b border-zinc-700">
      {/* Pinned height: the bar's contents arrive in stages — the channel
          dropdown only once the channels query says there's more than one, and
          the actions once the session lands — and those are h-8 buttons against
          a h-4 placeholder. Without a floor the bar grows as they appear and
          shoves the whole page down. 3.5rem = py-3 + h-8. */}
      <PageContainer className="flex min-h-14 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/logo-big.png" alt="" className="size-6 rounded-sm" />
            æme
          </Link>
          {session && channels && channels.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={switchChannel.isPending}
                    className="text-zinc-400"
                  >
                    #{session.channelName}
                    <ChevronDownIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {channels.map((channel) => (
                  <DropdownMenuItem
                    key={channel.channelId}
                    disabled={channel.channelId === session.channelId}
                    onClick={() => switchChannel.mutate(channel.channelId)}
                  >
                    <CheckIcon
                      className={
                        channel.channelId === session.channelId
                          ? "mr-2 size-4"
                          : "mr-2 size-4 opacity-0"
                      }
                    />
                    #{channel.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
                      {(!channels || channels.length <= 1) && (
                        <>
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            #{session.channelName}
                          </div>
                          <DropdownMenuSeparator />
                        </>
                      )}
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
