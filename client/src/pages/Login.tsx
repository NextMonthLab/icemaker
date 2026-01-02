import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLocation, useSearch } from "wouter";
import { useState } from "react";
import { Sparkles, Globe, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
const LOGO_URL = "/logo.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const returnUrl = params.get("return");
  
  // Guests can now view checkout pages, so use return URL directly
  const guestReturnUrl = returnUrl || "/try";
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isRegister) {
        await register(username, password);
        toast({
          title: "Account created",
          description: "Welcome to NextMonth!",
        });
        setLocation("/onboarding");
      } else {
        await login(username, password);
        toast({
          title: "Welcome back!",
          description: "Logged in successfully.",
        });
        // Redirect to return URL if provided, otherwise default to launchpad
        setLocation(returnUrl || "/launchpad");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Authentication failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col items-center justify-center p-3 relative overflow-hidden">
        
        {/* Background Ambience */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-black to-black opacity-50 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

        <div className="w-full max-w-md space-y-4 md:space-y-6 relative z-10">
            <div className="text-center space-y-1">
                <img 
                  src={LOGO_URL} 
                  alt="NextMonth" 
                  className="h-28 md:h-48 mx-auto object-contain"
                  style={{ clipPath: 'inset(35% 0 35% 0)' }}
                  data-testid="img-logo"
                />
                <p className="text-muted-foreground font-mono text-xs md:text-sm tracking-widest uppercase">
                    Create Experiences. Control AI Discovery.
                </p>
            </div>

            <Card className="bg-card/50 backdrop-blur-md border-white/10 shadow-2xl">
                <CardHeader className="space-y-1 pb-2 md:pb-4">
                    <CardTitle className="text-xl md:text-2xl font-bold text-center">
                      {isRegister ? "Create Your Account" : "Sign In"}
                    </CardTitle>
                    <CardDescription className="text-center text-xs md:text-sm">
                        {isRegister 
                          ? "Get started with IceMaker and Orbit" 
                          : "Access your IceMaker projects and Orbit dashboard"
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="username" className="text-sm">Username</Label>
                            <Input 
                                id="username"
                                data-testid="input-username"
                                placeholder="detective"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required 
                                className="bg-black/50 border-white/10 h-10"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="password" className="text-sm">Password</Label>
                            <Input 
                                id="password"
                                data-testid="input-password"
                                placeholder="••••••••"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                                className="bg-black/50 border-white/10 h-10"
                            />
                        </div>
                        <Button 
                          className="w-full h-10 font-bold tracking-wide" 
                          disabled={isLoading}
                          data-testid="button-submit"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {isRegister ? "Creating..." : "Accessing..."}
                                </span>
                            ) : (
                                isRegister ? "CREATE ACCOUNT" : "CONTINUE"
                            )}
                        </Button>
                    </form>

                    <div className="relative my-3 md:my-5">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-2 text-muted-foreground font-mono">
                              {isRegister ? "Already have an account?" : "New here?"}
                            </span>
                        </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-9 border-white/10 hover:bg-white/5"
                      data-testid="button-toggle-mode"
                      onClick={() => setIsRegister(!isRegister)}
                      type="button"
                    >
                        {isRegister ? "Log In Instead" : "Create Account"}
                    </Button>
                    
                    <div className="mt-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-full text-muted-foreground hover:text-white"
                        data-testid="button-guest"
                        onClick={() => setLocation(guestReturnUrl)}
                        type="button"
                      >
                          Continue as Guest
                      </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-center gap-4 md:gap-8 text-[10px] md:text-xs text-muted-foreground font-mono tracking-widest uppercase opacity-50">
                <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> IceMaker
                </div>
                <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Orbit
                </div>
                <div className="flex items-center gap-1">
                    <User className="w-3 h-3" /> One Account
                </div>
            </div>
        </div>
    </div>
  );
}
