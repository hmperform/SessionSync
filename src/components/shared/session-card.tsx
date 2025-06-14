
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Video, FileText, ClockIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Session {
  id: string;
  clientName?: string; // Optional for client view if they are the client
  coachName?: string; // Optional for coach view if they are the coach
  sessionDate: string;
  sessionType: 'Full' | 'Half';
  notes?: string; // Could be full notes or summary
  summary?: string;
  videoLink?: string;
  status?: 'Logged' | 'Reviewed' | 'Billed'; // For admin/coach views
}

interface SessionCardProps {
  session: Session;
  showActions?: boolean; // To conditionally show action buttons
  onViewDetails?: (session: Session) => void; // Example action
}

export function SessionCard({ session, showActions = false, onViewDetails }: SessionCardProps) {
  const displayDate = new Date(session.sessionDate).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <Card className="shadow-light hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            {session.clientName && <CardTitle className="font-headline text-xl mb-1">{session.clientName}</CardTitle>}
            {session.coachName && <CardDescription className="text-sm">With {session.coachName}</CardDescription>}
          </div>
          <Badge variant={session.sessionType === 'Full' ? 'default' : 'secondary'} className="capitalize">
            {session.sessionType} Session
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="mr-2 h-4 w-4 text-primary" />
          <span>{displayDate}</span>
        </div>
        
        {session.summary && (
          <div className="flex items-start text-sm">
            <FileText className="mr-2 h-4 w-4 mt-1 text-primary shrink-0" />
            <p className="text-muted-foreground truncate-3-lines">{session.summary}</p>
          </div>
        )}

        {session.videoLink && (
          <div className="flex items-center text-sm">
             <Video className="mr-2 h-4 w-4 text-primary" />
            <a href={session.videoLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              View Recording
            </a>
          </div>
        )}
        
        {session.status && (
           <div className="flex items-center text-sm">
            <ClockIcon className="mr-2 h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Status: {session.status}</span>
          </div>
        )}

      </CardContent>
      {showActions && onViewDetails && (
        <CardFooter>
          <Button variant="outline" onClick={() => onViewDetails(session)} className="w-full hover:border-primary">
            View Details
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
