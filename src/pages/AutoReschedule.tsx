import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, RefreshCw, Home, PlusCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const initSchedule = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    // 1. Fetch live schedule directly from Supabase
    const { data: dbSchedule, error: schedError } = await supabase
      .from("schedules")
      .select("schedule_data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!schedError && dbSchedule && Array.isArray(dbSchedule.schedule_data) && dbSchedule.schedule_data.length > 0) {
      setSchedule(dbSchedule.schedule_data as ScheduleItem[]);
      setLoading(false);
      return;
    }

    // 2. Fallback: Generate fresh schedule if none exists
    const { data: dbTasks, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id);

    if (!taskError && dbTasks && dbTasks.length > 0) {
      const generated: ScheduleItem[] = [];

      dbTasks.forEach((task: any, index: number) => {
        const day = daysOfWeek[index % daysOfWeek.length];
        const duration = Number(task.hours_required || task.daily_time || task.total_time || 2);
        const startHour = 9 + (index % 3) * 3;

        generated.push({
          id: `${task.id}-init-${Date.now()}`,
          taskId: task.id,
          taskName: task.title || "Study Session",
          day,
          startTime: `${startHour.toString().padStart(2, '0')}:00`,
          endTime: `${(startHour + duration).toString().padStart(2, '0')}:00`,
          duration
        });
      });

      setSchedule(generated);

      // Save generated schedule to Supabase
      await supabase.from("schedules").upsert({
        user_id: user.id,
        schedule_data: generated,
        updated_at: new Date().toISOString()
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    initSchedule();
  }, []);

  const handleForceRegenerate = async () => {
    if (userId) {
      setLoading(true);
      await supabase.from("schedules").delete().eq("user_id", userId);
      await initSchedule();
    }
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
            This timeline reflects all updates synced directly with your Supabase database.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => navigate("/routine")}
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-2"
            >
              <Home className="h-4 w-4" />
              Return to Home
            </Button>

            <Button
              onClick={() => navigate("/tasks")}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add New Tasks
            </Button>

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
              className="bg-teal-500 hover:bg-teal-600 text-white gap-2"
            >
              Go to Rescheduler
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default ScheduleGenerator;