import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScheduleItem {
  id: string;
  taskId: string;
  taskName: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ScheduleDisplay = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const navigate = useNavigate();

  const loadSchedule = () => {
    // 1. Try loading existing/rescheduled schedule
    const savedSchedule = localStorage.getItem("panicmode_schedule");
    if (savedSchedule) {
      try {
        setSchedule(JSON.parse(savedSchedule));
        return;
      } catch (e) {
        console.error("Failed to parse schedule", e);
      }
    }

    // 2. Fallback: Generate initial schedule from tasks if none exists
    const savedTasks = localStorage.getItem("panicmode_tasks");
    if (savedTasks) {
      try {
        const tasks = JSON.parse(savedTasks);
        if (Array.isArray(tasks) && tasks.length > 0) {
          const generated: ScheduleItem[] = [];
          
          tasks.forEach((task: any, index: number) => {
            const day = daysOfWeek[index % daysOfWeek.length];
            const duration = task.dailyTime || task.totalTime || 2;
            const startHour = 9 + (index % 4) * 2;
            
            generated.push({
              id: `${task.id}-init-${Date.now()}`,
              taskId: task.id,
              taskName: task.name,
              day,
              startTime: `${startHour.toString().padStart(2, '0')}:00`,
              endTime: `${(startHour + duration).toString().padStart(2, '0')}:00`,
              duration
            });
          });

          setSchedule(generated);
          localStorage.setItem("panicmode_schedule", JSON.stringify(generated));
        }
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleRegenerate = () => {
    localStorage.removeItem("panicmode_schedule");
    loadSchedule();
    toast({
      title: "Schedule Reset!",
      description: "Re-generated schedule from scratch based on your tasks.",
    });
  };

  const groupedSchedule = schedule.reduce((acc, session) => {
    if (!acc[session.day]) {
      acc[session.day] = [];
    }
    acc[session.day].push(session);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  if (schedule.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 flex items-center justify-center p-4">
        <Card className="max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center p-8">
            <AlertCircle className="h-12 w-12 text-teal-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-teal-600 mb-2">No Schedule Available</h2>
            <p className="text-gray-600 mb-6">Add tasks first so we can generate your study timeline.</p>
            <Button onClick={() => navigate("/tasks")} className="bg-teal-500 hover:bg-teal-600">
              Add Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">Your Weekly Schedule</h1>
          <p className="text-gray-600 mb-4">View your full study timetable below. Changes from the auto-rescheduler will display here automatically.</p>
          <div className="flex justify-center gap-4">
            <Button onClick={handleRegenerate} variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-2">
              <RefreshCw className="h-4 w-4" />
              Reset & Regenerate
            </Button>
            <Button onClick={() => navigate("/auto-reschedule")} className="bg-teal-500 hover:bg-teal-600 gap-2">
              Smart Reschedule
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {daysOfWeek.map(day => {
            const daySessions = groupedSchedule[day] || [];

            return (
              <Card key={day} className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-teal-600 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {day}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {daySessions.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4">Free day</p>
                  ) : (
                    daySessions.map(session => (
                      <div key={session.id} className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                        <div className="font-medium text-gray-800">{session.taskName}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScheduleDisplay;