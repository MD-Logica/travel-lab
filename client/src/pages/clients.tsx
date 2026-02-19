import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, Phone, MapPin } from "lucide-react";
import type { Profile } from "@shared/schema";

export default function ClientsPage() {
  const { data: clients, isLoading } = useQuery<Profile[]>({
    queryKey: ["/api/clients"],
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Manage</p>
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-clients-title">Clients</h1>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clients && clients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Card className="hover-elevate">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-medium text-sm" data-testid={`text-client-name-${client.id}`}>
                        {client.fullName}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider shrink-0">
                        {client.role}
                      </Badge>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Mail className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-lg mb-2">No clients yet</h3>
              <p className="text-sm text-muted-foreground">
                Clients will appear here as you add them to your agency.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
