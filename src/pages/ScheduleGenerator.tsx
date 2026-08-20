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

interface RoutineActivity {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

const minutesToTime = (minNum: number): string => {
  const hours = Math.floor(minNum / 60) % 24;
  const minutes = Math.round(minNum % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const getRoutineIntervals = (startTime: string, endTime: string): [number, number][] => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start < end) {
    return [[start, end]];
  } else {
    // Overnight routines (e.g. 22:00 -> 06:00)
    return [
      [start, 24 * 60],
      [0, end]
    ];
  }
};

const ScheduleGenerator = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const generateCompleteSchedule = (tasks: any[], routines: RoutineActivity[]): ScheduleItem[] => {
    const generated: ScheduleItem[] = [];

    // 1. Build minute-by-minute occupancy map for each day (1440 mins/day)
    const dayOccupancy: Record<string, boolean[]> = {};
    daysOfWeek.forEach((day) => {
      dayOccupancy[day] = new Array(1440).fill(false);
    });

    // Mark routines as occupied slots
    routines.forEach((r) => {
      if (r.startTime && r.endTime) {
        const intervals = getRoutineIntervals(r.startTime, r.endTime);
        daysOfWeek.forEach((day) => {
          intervals.forEach(([startMin, endMin]) => {
            for (let m = startMin; m < endMin; m++) {
              if (m < 1440) dayOccupancy[day][m] = true;
            }
          });
        });
      }
    });

    // 2. Place Pinned Reminders first
    const autoTasks: any[] = [];
    tasks.forEach((task) => {
      if (task.task_type === "pinned" && task.pinned_datetime) {
        const pinDate = new Date(task.pinned_datetime);
        const dayName = daysOfWeek[pinDate.getDay() === 0 ? 6 : pinDate.getDay() - 1];
        const startMin = pinDate.getHours() * 60 + pinDate.getMinutes();
        const endMin = Math.min(1440, startMin + 60);

        generated.push({
          id: `${task.id}-pin`,
          taskId: task.id,
          taskName: `[Pinned] ${task.title}`,
          day: dayName,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          duration: 1
        });

        for (let m = startMin; m < endMin; m++) {
          dayOccupancy[dayName][m] = true;
        }
      } else {
        autoTasks.push(task);
      }
    });

    // 3. Helper to find open continuous free slots on a specific day between 07:00 (420 min) and 23:00 (1380 min)
    const findFreeSlot = (day: string, durationMinutes: number): { start: number; end: number } | null => {
      const occupancy = dayOccupancy[day];
      for (let startMin = 420; startMin + durationMinutes <= 1380; startMin += 15) {
        let hasConflict = false;
        for (let m = startMin; m < startMin + durationMinutes; m++) {
          if (occupancy[m]) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          return { start: startMin, end: startMin + durationMinutes };
        }
      }
      return null;
    };

    // 4. Schedule Daily Tasks (Repeat across EVERY day of the week)
    const dailyTasks = autoTasks.filter((t) => t.time_mode === "daily" || t.daily_time);
    const totalTasks = autoTasks.filter((t) => t.time_mode !== "daily" && !t.daily_time);

    dailyTasks.forEach((task) => {
      const dailyHours = Number(task.hours_required || task.daily_time || 2);
      const reqMinutes = Math.max(30, Math.round(dailyHours * 60));

      daysOfWeek.forEach((day) => {
        const slot = findFreeSlot(day, reqMinutes);
        if (slot) {
          generated.push({
            id: `${task.id}-daily-${day}`,
            taskId: task.id,
            taskName: task.title,
            day,
            startTime: minutesToTime(slot.start),
            endTime: minutesToTime(slot.end),
            duration: dailyHours
          });

          for (let m = slot.start; m < slot.end; m++) {
            dayOccupancy[day][m] = true;
          }
        }
      });
    });

    // 5. Schedule Total Time Tasks (Spread total required hours across free days in 2-3 hour daily chunks)
    totalTasks.forEach((task) => {
      let totalHoursRemaining = Number(task.hours_required || task.total_time || 2);

      // Iterate across days until all required hours are allocated
      for (let pass = 0; pass < 3 && totalHoursRemaining > 0; pass++) {
        daysOfWeek.forEach((day) => {
          if (totalHoursRemaining <= 0) return;

          const sessionHours = Math.min(3, totalHoursRemaining); // Max 3 hours per session
          const reqMinutes = Math.max(30, Math.round(sessionHours * 60));

          const slot = findFreeSlot(day, reqMinutes);
          if (slot) {
            generated.push({
              id: `${task.id}-total-${day}-${totalHoursRemaining}`,
              taskId: task.id,
              taskName: `${task.title} (${sessionHours}h)`,
              day,
              startTime: minutesToTime(slot.start),
              endTime: minutesToTime(slot.end),
              duration: sessionHours
            });

            for (let m = slot.start; m < slot.end; m++) {
              dayOccupancy[day][m] = true;
            }

            totalHoursRemaining -= sessionHours;
          }
        });
      }
    });

    return generated;
  };

  const initSchedule = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    // 1. Fetch live routines and tasks directly from Supabase
    const { data: dbRoutines } = await supabase
      .from("routines")
      .select("activities")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: dbTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id);

    const routineActivities: RoutineActivity[] = dbRoutines?.activities || [];
    const userTasks = dbTasks || [];

    if (userTasks.length > 0) {
      const generated = generateCompleteSchedule(userTasks, routineActivities);
      setSchedule(generated);

      // Upsert into schedules table so AutoReschedule page gets the exact same schedule
      await supabase.from("schedules").upsert({
        user_id: user.id,
        schedule_data: generated,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
    } else {
      setSchedule([]);
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
            Auto-scheduled strictly into free time slots around your daily routines.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => navigate("/routine")}
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-2"
            >
              <Home className="h-4 w-4" />
              Return to Routine
            </Button>

            <Button
              onClick={() => navigate("/tasks")}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add / Manage Tasks
            </Button>

            <Button
              onClick={handleForceRegenerate}
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset & Regenerate
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
                      <p className="text-gray-400 text-sm py-4">No study sessions scheduled</p>
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