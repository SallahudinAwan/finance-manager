import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, CircleAlert, PiggyBank, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { api, postJson } from "../api/client";
import { EmptyState, ErrorPanel, PageHeader, Skeleton } from "../components/ui";
import type { Notification, Paginated } from "../types";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Paginated<Notification>>("/notifications/"),
  });
  const readAll = useMutation({
    mutationFn: () => postJson("/notifications/read_all/", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  if (query.isLoading) return <Skeleton height={430} />;
  if (query.isError || !query.data) return <ErrorPanel />;

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Nothing important should slip"
        description="Bill due dates and savings target reminders appear here before they become surprises."
        actions={
          query.data.results.some((item) => !item.read_at) ? (
            <button className="button secondary" onClick={() => readAll.mutate()}>
              <CheckCheck size={17} /> Mark all read
            </button>
          ) : undefined
        }
      />
      <section className="panel notification-panel" data-tour="notifications">
        {query.data.results.length ? (
          <div className="notification-list">
            {query.data.results.map((item) => {
              const Icon =
                item.kind === "savings"
                  ? PiggyBank
                  : item.kind.includes("bill")
                    ? ReceiptText
                    : CircleAlert;
              return (
                <Link
                  to={item.action_url || "/app"}
                  className={`notification-row ${item.read_at ? "" : "unread"}`}
                  key={item.id}
                  onClick={() => postJson(`/notifications/${item.id}/read/`, {})}
                >
                  <span className={`notification-icon ${item.kind}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                  </div>
                  {!item.read_at && <span className="unread-dot" />}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Bell size={24} />}
            title="You are all caught up"
            description="Upcoming bills and savings reminders will appear here."
          />
        )}
      </section>
    </>
  );
}
