
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { UserPlus, AlertTriangle, Loader2, ShieldCheck, User, Briefcase, Mail, Building, LogIn, ChevronsRight, Crown } from 'lucide-react';

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/context/role-context';
import { getAllCoaches, type UserProfile, type UserProfile as CoachProfile } from '@/lib/firestoreService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

// This function determines the role based on email address rules.
const determineRole = (email: string | null): UserRole => {
  const normalizedEmail = (email || '').toLowerCase();
  const SUPER_ADMIN_EMAIL = 'supersuper@hmperform.com';
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || ['hello@hmperform.com']);

  if (normalizedEmail === SUPER_ADMIN_EMAIL) {
    return 'super-admin';
  }
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return 'admin';
  }
  if (normalizedEmail.endsWith('@hmperform.com')) {
    return 'coach';
  }
  return 'client';
};

const signupFormSchema = z
  .object({
    displayName: z.string().min(3, { message: 'Full name must be at least 3 characters.' }),
    email: z.string().email({ message: 'Please enter a valid email address.' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
    confirmPassword: z.string().min(6, { message: 'Please confirm your password.' }),
    coachId: z.string().optional(),
    coachName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })
  .refine((data) => {
    // If the determined role is client, then a coach must be selected.
    if (determineRole(data.email) === 'client') {
      return !!data.coachId;
    }
    return true;
  }, {
    message: "Please select your coach to complete signup.",
    path: ["coachId"],
  });


type SignupFormValues = z.infer<typeof signupFormSchema>;

const DEFAULT_COMPANY_ID = 'hearts-and-minds';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningUp, setIsSigningUp] = React.useState(false);
  const [firebaseNotConfigured, setFirebaseNotConfigured] = React.useState(false);
  const [autoAssignedRole, setAutoAssignedRole] = React.useState<UserRole | null>(null);

  const [coaches, setCoaches] = React.useState<CoachProfile[]>([]);
  const [isLoadingCoaches, setIsLoadingCoaches] = React.useState(true);
  const [isCoachSelectorOpen, setIsCoachSelectorOpen] = React.useState(false);


  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      coachId: '',
      coachName: '',
    },
    mode: 'onChange',
  });

  const emailValue = form.watch('email');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && !isFirebaseConfigured()) {
      setFirebaseNotConfigured(true);
      toast({
        title: 'Firebase Not Configured',
        description: 'Sign up is disabled. Please configure Firebase.',
        variant: 'destructive',
        duration: Infinity,
      });
    }
  }, [toast]);

  React.useEffect(() => {
    const fetchCoaches = async () => {
      if (!isFirebaseConfigured()) return;
      setIsLoadingCoaches(true);
      try {
        // Fetch coaches from the default company for new signups
        const fetchedCoaches = await getAllCoaches(DEFAULT_COMPANY_ID);
        setCoaches(fetchedCoaches);
      } catch (error) {
        console.error("Failed to fetch coaches:", error);
        toast({ title: "Could not load coaches", description: "There was an error fetching the list of available coaches.", variant: "destructive" });
      } finally {
        setIsLoadingCoaches(false);
      }
    };
    fetchCoaches();
  }, [toast]);

  React.useEffect(() => {
    if (emailValue && z.string().email().safeParse(emailValue).success) {
      const role = determineRole(emailValue);
      setAutoAssignedRole(role);
    } else {
      setAutoAssignedRole(null);
    }
  }, [emailValue]);

  const handleSelectCoach = (coach: CoachProfile) => {
    form.setValue('coachId', coach.uid, { shouldValidate: true });
    form.setValue('coachName', coach.displayName, { shouldValidate: true });
    setIsCoachSelectorOpen(false);
  };


  const getRoleIcon = (role: UserRole | null) => {
    if (!role) return <Mail className="h-4 w-4 text-muted-foreground" />;
    switch (role) {
      case 'super-admin': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <ShieldCheck className="h-4 w-4 text-primary" />;
      case 'coach': return <Briefcase className="h-4 w-4 text-blue-500" />;
      case 'client': return <User className="h-4 w-4 text-green-500" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const onSubmit: SubmitHandler<SignupFormValues> = async (data) => {
    if (firebaseNotConfigured) {
      toast({ title: 'Sign Up Disabled', description: 'Firebase is not configured.', variant: 'destructive' });
      return;
    }

    setIsSigningUp(true);

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      // 2. Update the user's display name in their Auth profile
      await updateProfile(firebaseUser, { displayName: data.displayName });

      // 3. Create the user's profile document in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const role = determineRole(firebaseUser.email);
      
      const selectedCoach = coaches.find(c => c.uid === data.coachId);
      const companyId = role === 'client' ? selectedCoach?.companyId : DEFAULT_COMPANY_ID;
      
      if (!companyId) {
        throw new Error("Could not determine company for the new user. Signup aborted.");
      }

      const userProfileData: any = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: data.displayName,
        role: role,
        createdAt: Timestamp.now(),
        photoURL: firebaseUser.photoURL || null,
        companyId: companyId,
      };

      if (role === 'client' && data.coachId) {
        userProfileData.coachId = data.coachId;
      }

      await setDoc(userDocRef, userProfileData);

      toast({
        title: 'Account Created!',
        description: 'Your account has been successfully created. Please log in.',
      });
      router.push('/login');

    } catch (error: any) {
      let toastMessage = 'An unexpected error occurred during sign up. Please try again.';
      if (error instanceof RangeError) {
        toastMessage = "Signup failed due to an internal error (Stack Overflow). Please contact support.";
      } else if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            toastMessage = 'This email address is already in use.';
            break;
          case 'auth/weak-password':
            toastMessage = 'The password is too weak.';
            break;
          case 'permission-denied':
            toastMessage = "Signup failed due to permissions. Please check your Firestore rules and contact support.";
            break;
          default:
            toastMessage = `An error occurred: ${error.code}. Please try again.`;
        }
      } else if (error.message) {
        toastMessage = error.message;
      }

      toast({ title: 'Sign Up Failed', description: toastMessage, variant: 'destructive' });
    } finally {
      setIsSigningUp(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6 selection:bg-primary/20">
      <Card className="w-full max-w-lg shadow-xl rounded-xl border-border/50 overflow-hidden">
        <CardHeader className="bg-card p-8 text-center">
          <Link href="/" className="inline-block mb-6 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card rounded-md">
            <Building className="h-12 w-12 text-primary transition-transform duration-300 ease-in-out hover:scale-110" />
          </Link>
          <CardTitle className="text-3xl font-headline font-bold text-foreground tracking-tight">
            Create Your ClientFocus Account
          </CardTitle>
          <CardDescription className="text-muted-foreground pt-2 text-base">
            Join our platform to streamline your coaching and client management.
            Your role is auto-assigned based on your email.
          </CardDescription>
          {firebaseNotConfigured && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Firebase is not configured. Sign up is disabled.</span>
            </div>
          )}
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 p-8">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/90 font-medium text-sm">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Alex Johnson"
                        {...field}
                        disabled={isSigningUp || firebaseNotConfigured}
                        className="bg-background/80 border-input focus:border-primary h-11 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/90 font-medium text-sm">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        disabled={isSigningUp || firebaseNotConfigured}
                        className="bg-background/80 border-input focus:border-primary h-11 text-base"
                      />
                    </FormControl>
                    {autoAssignedRole && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 pl-1">
                        {getRoleIcon(autoAssignedRole)}
                        Anticipated role: <span className="font-semibold capitalize">{autoAssignedRole?.replace('-', ' ')}</span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/90 font-medium text-sm">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="•••••••• (min. 6 characters)"
                          {...field}
                          disabled={isSigningUp || firebaseNotConfigured}
                          className="bg-background/80 border-input focus:border-primary h-11 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/90 font-medium text-sm">Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isSigningUp || firebaseNotConfigured}
                          className="bg-background/80 border-input focus:border-primary h-11 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {autoAssignedRole === 'client' && (
                <FormField
                  control={form.control}
                  name="coachId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Coach</FormLabel>
                      <FormControl>
                        <Dialog open={isCoachSelectorOpen} onOpenChange={setIsCoachSelectorOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal h-11 text-base">
                              {form.getValues('coachName') || "Select your coach..."}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[625px]">
                            <DialogHeader>
                              <DialogTitle>Select Your Coach</DialogTitle>
                              <DialogDescription>
                                Choose the coach you will be working with from the list below.
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[400px] pr-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {isLoadingCoaches ? (
                                  Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                                      <Skeleton className="h-12 w-12 rounded-full" />
                                      <div className="space-y-2">
                                        <Skeleton className="h-4 w-[150px]" />
                                      </div>
                                    </div>
                                  ))
                                ) : coaches.length > 0 ? (
                                  coaches.map(coach => (
                                    <button key={coach.uid} type="button" onClick={() => handleSelectCoach(coach)} className="block w-full text-left p-4 border rounded-lg hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors">
                                      <div className="flex items-center space-x-4">
                                        <Avatar className="h-12 w-12">
                                          <AvatarImage src={coach.photoURL || undefined} alt={coach.displayName} />
                                          <AvatarFallback>{coach.displayName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{coach.displayName}</div>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-muted-foreground col-span-2 text-center py-8">No coaches are available at this time.</p>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}


            </CardContent>
            <CardFooter className="flex flex-col items-center p-8 pt-2 bg-card">
              <Button
                type="submit"
                className="w-full text-lg py-3 h-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.01] focus:scale-[1.01] focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:bg-primary/70"
                disabled={isSigningUp || firebaseNotConfigured || !form.formState.isValid}
              >
                {isSigningUp ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-5 w-5" />
                )}
                {isSigningUp ? 'Creating Account...' : 'Create Account'}
              </Button>
              <p className="mt-6 text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline hover:text-primary/90 flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-primary focus:rounded-sm"
                >
                  <LogIn className="h-4 w-4" /> Log In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
      {firebaseNotConfigured && (
        <p className="mt-4 text-xs text-destructive text-center max-w-md">
          Critical: Firebase is not configured. Sign up functionality is disabled. Please check your <code>src/lib/firebase.ts</code> file or environment variables.
        </p>
      )}
    </div>
  );
}
