import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plane, Hotel, Car, UtensilsCrossed, Activity, StickyNote, Diamond, Ship,
  Search, Trash2, Bookmark, Hash,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const segmentTypeConfig: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Flight", icon: Plane, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  charter_flight: { label: "Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  charter: { label: "Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  hotel: { label: "Hotel", icon: Hotel, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  transport: { label: "Transport", icon: Car, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  cruise: { label: "Cruise", icon: Ship, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  activity: { label: "Activity", icon: Activity, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  note: { label: "Note", icon: StickyNote, color: "text-muted-foreground bg-muted/60" },
};

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/segment-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/segment-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t: any) =>
        t.label?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl tracking-tight" data-testid="text-templates-title">
            Template Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-templates-subtitle">
            Reusable segments for quick itinerary building
          </p>
        </div>

        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Search by name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-template-search"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-28" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" data-testid="text-templates-empty">
            <Bookmark className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" strokeWidth={1} />
            <p className="text-muted-foreground text-sm">
              {templates.length === 0
                ? "No templates yet. Save a segment as a template when adding it to a trip."
                : "No templates match your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tpl: any) => {
              const cfg = segmentTypeConfig[tpl.type] || segmentTypeConfig.activity;
              const TypeIcon = cfg.icon;
              return (
                <Card
                  key={tpl.id}
                  className="group hover:shadow-md transition-shadow"
                  data-testid={`card-template-${tpl.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <TypeIcon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-template-label-${tpl.id}`}>
                          {tpl.label}
                        </p>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {cfg.label}
                        </Badge>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            data-testid={`button-delete-template-${tpl.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove "{tpl.label}" from your template library. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(tpl.id)}
                              data-testid={`button-confirm-delete-template-${tpl.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" strokeWidth={1.5} />
                        Used {tpl.useCount || 0} {tpl.useCount === 1 ? "time" : "times"}
                      </span>
                      {tpl.createdAt && (
                        <span>Created {format(new Date(tpl.createdAt), "MMM d")}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
