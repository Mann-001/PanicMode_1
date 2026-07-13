
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/panicmode-logo.png";


const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    // Simple validation for demo purposes
    if (email.includes("@") && password.length >= 6) {
      localStorage.setItem("panicmode_user", JSON.stringify({ email }));
      toast({
        title: "Welcome to PanicMode!",
        description: "Let's set up your study schedule",
      });
      navigate("/routine");
    } else {
      toast({
        title: "Invalid credentials",
        description: "Please check your email and password",
        variant: "destructive",
      });
    }
  };

  const handleDownloadLogo = async () => {
    try {
      const response = await fetch(logo);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "panicmode-logo.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Logo downloaded",
        description: "panicmode-logo.png saved to your device",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download the logo. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center gap-3">
            <img
              src={logo}
              alt="PanicMode logo"
              width={80}
              height={80}
              className="rounded-2xl"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadLogo}
              className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800 rounded-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Icon
            </Button>
          </div>
          <CardTitle className="text-3xl font-bold text-teal-600 mt-4 mb-2">
            PanicMode
          </CardTitle>
          <p className="text-gray-600">Your smart study planner</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-teal-200 focus:border-teal-400 focus:ring-teal-400"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-teal-200 focus:border-teal-400 focus:ring-teal-400"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
