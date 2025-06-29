
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import DailyRoutine from "./pages/DailyRoutine";
import TaskInput from "./pages/TaskInput";
import ScheduleGenerator from "./pages/ScheduleGenerator";
import AutoReschedule from "./pages/AutoReschedule";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/routine" element={<DailyRoutine />} />
          <Route path="/tasks" element={<TaskInput />} />
          <Route path="/schedule" element={<ScheduleGenerator />} />
          <Route path="/reschedule" element={<AutoReschedule />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
