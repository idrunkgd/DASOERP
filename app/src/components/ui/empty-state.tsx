import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Aucun élément",
  description,
  action,
  icon: Icon = Inbox
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: any;
}) {
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-midnight-50 grid place-items-center mb-3">
        <Icon className="w-5 h-5 text-midnight-400" />
      </div>
      <h3 className="text-sm font-semibold text-midnight-900">{title}</h3>
      {description && <p className="text-sm text-midnight-500 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
