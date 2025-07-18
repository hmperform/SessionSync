
'use client';

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, UserCircle, Calendar } from "lucide-react";
import Link from "next/link";
import { useRole } from "@/context/role-context";

export default function ClientDashboardPage() {
    const { userProfile } = useRole();

    return (
        <div>
            <PageHeader 
                title={`Welcome, ${userProfile?.displayName || 'Client'}!`} 
                description="Here's a summary of your coaching journey." 
            />
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-light hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <History className="h-6 w-6 text-primary" />
                            Session History
                        </CardTitle>
                        <CardDescription>
                            Review your past sessions, notes, and recordings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/client/history">
                                View History
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-light opacity-50 cursor-not-allowed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <Calendar className="h-6 w-6 text-muted-foreground" />
                            Upcoming Sessions
                        </CardTitle>
                        <CardDescription>
                            Feature coming soon! View and manage your scheduled sessions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button disabled className="w-full">
                            View Schedule (Soon)
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-light opacity-50 cursor-not-allowed">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <UserCircle className="h-6 w-6 text-muted-foreground" />
                            My Profile
                        </CardTitle>
                        <CardDescription>
                            Feature coming soon! Manage your personal information and settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button disabled className="w-full">
                            Edit Profile (Soon)
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
