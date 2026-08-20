import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, RefreshCw } from "lucide-react";
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

const ScheduleGenerator = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. PRIORITIZE SAVED/RESCHEDULED SCHEDULE
    const savedSchedule = localStorage.getItem("panicmode_schedule");
    if (savedSchedule) {
      try {
        const parsed = JSON.parse(savedSchedule);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSchedule(parsed);
          return; // Stop here so we don't overwrite rescheduled tasks!
        }
      } catch (e) {
        console.error("Failed to parse saved schedule", e);
      }
    }

    // 2. FALLBACK: Generate schedule from tasks if no saved schedule exists
    const savedTasks = localStorage.getItem("panicmode_tasks");
    if (savedTasks) {
      try {
        const tasks = JSON.parse(savedTasks);
        if (Array.isArray(tasks) && tasks.length > 0) {
          const generated: ScheduleItem[] = [];
          
          tasks.forEach((task: any, index: number) => {
            const day = daysOfWeek[index % daysOfWeek.length];
            const duration = Number(task.dailyTime || task.totalTime || 2);
            const startHour = 9 + (index % 3) * 3;
            
            generated.push({
              id: `${task.id || index}-init-${Date.now()}`,
              taskId: task.id || `task-${index}`,
              taskName: task.name || task.title || "Study Session",
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
  }, []);

  const handleForceRegenerate = () => {
    // Clear saved schedule to allow fresh generation from tasks
    localStorage.removeItem("panicmode_schedule");
    window.location.reload();
  };

  const groupedSchedule = schedule.reduce((acc, session) => {
    if (!acc[session.day]) {
      acc[session.day] = [];
    }
    acc[session.day].push(session);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">Your Live Schedule</h1>
          <p className="text-gray-600 mb-4">
            This timeline reflects all updates made from the auto-rescheduler.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleForceRegenerate}
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset & Force Regenerate
            </Button>
            <Button
              onClick={() => navigate("/reschedule")}
              className="bg-teal-500 hover:bg-teal-600 gap-2"
            >
              Go to Rescheduler
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
                    <p className="text-gray-400 text-sm py-4">No sessions scheduled</p>
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

export default ScheduleGenerator;