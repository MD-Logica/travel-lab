import { Mail, Phone, Globe } from "lucide-react";

interface AdvisorContactCardProps {
  advisor: {
    fullName: string;
    email: string | null;
    avatarUrl: string | null;
    phone: string | null;
    website: string | null;
  };
  organization: { name: string; logoUrl: string | null };
}

export function AdvisorContactCard({ advisor, organization }: AdvisorContactCardProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border border-border/50 bg-card shadow-sm max-w-lg mx-auto" data-testid="advisor-contact-card">
      {advisor.avatarUrl ? (
        <img src={advisor.avatarUrl} alt={advisor.fullName}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-border/30 shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-border/30">
          <span className="text-xl font-serif text-primary">
            {advisor.fullName.charAt(0)}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-serif font-semibold text-base text-foreground" data-testid="text-advisor-name">
          {advisor.fullName}
        </p>
        <p className="text-xs text-muted-foreground mb-1.5" data-testid="text-advisor-org">
          {organization.name}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {advisor.email && (
            <a href={`mailto:${advisor.email}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-advisor-email">
              <Mail className="w-3 h-3" />
              {advisor.email}
            </a>
          )}
          {advisor.phone && (
            <a href={`tel:${advisor.phone}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-advisor-phone">
              <Phone className="w-3 h-3" />
              {advisor.phone}
            </a>
          )}
          {advisor.website && (
            <a href={advisor.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-advisor-website">
              <Globe className="w-3 h-3" />
              {advisor.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
