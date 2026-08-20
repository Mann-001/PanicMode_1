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

// Return routine intervals in minutes. Handles overnight ranges like 22:00 -> 06:00
const getRoutineIntervals = (startTime: string, endTime: string): [number, number][] => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start < end) {
    return [[start, end]];
  } else {
    // Overnight activity: splits into [start -> 1440] and [0 -> end]
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

  const generateStrictNonOverlappingSchedule = (
    tasks: any[],
    routines: RoutineActivity[]
  ): ScheduleItem[] => {
    const generated: ScheduleItem[] = [];

    // 1. Build a 24-hour occupancy mask for routine activities
    const routineIntervals: [number, number][] = [];
    routines.forEach((r) => {
      if (r.startTime && r.endTime) {
        const intervals = getRoutineIntervals(r.startTime, r.endTime);
        routineIntervals.push(...intervals);
      }
    });

    // 2. Track minute-by-minute occupancy per day (1440 minutes in a day)
    const dayOccupancy: Record<string, boolean[]> = {};
    daysOfWeek.forEach((day) => {
      dayOccupancy[day] = new Array(1440).fill(false);

      // Fill routine blocked slots
      routineIntervals.forEach(([startMin, endMin]) => {
        for (let m = startMin; m < endMin; m++) {
          if (m < 1440) dayOccupancy[day][m] = true;
        }
      });
    });

    // 3. Separate Pinned Reminders vs Auto-Scheduled Tasks
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

        // Mark pinned time as occupied
        for (let m = startMin; m < endMin; m++) {
          dayOccupancy[dayName][m] = true;
        }
      } else {
        autoTasks.push(task);
      }
    });

    // 4. Schedule Auto-Scheduled Tasks across open slots
    autoTasks.forEach((task, index) => {
      const reqHours = Number(task.hours_required || task.daily_time || task.total_time || 2);
      const reqMinutes = Math.max(30, Math.round(reqHours * 60)); // Minimum 30 mins
      let isScheduled = false;

      // Try each day starting from an offset based on the task index
      for (let dayOffset = 0; dayOffset < daysOfWeek.length; dayOffset++) {
        if (isScheduled) break;

        const currentDay = daysOfWeek[(index + dayOffset) % daysOfWeek.length];
        const occupancy = dayOccupancy[currentDay];

        // Search waking hours (07:00 to 22:30 -> 420 min to 1350 min)
        for (let startMin = 420; startMin + reqMinutes <= 1350; startMin += 30) {
          let hasConflict = false;

          // Check if entire required window is completely free
          for (let m = startMin; m < startMin + reqMinutes; m++) {
            if (occupancy[m]) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            const endMin = startMin + reqMinutes;

            generated.push({
              id: `${task.id}-auto-${Date.now()}-${index}`,
              taskId: task.id,
              taskName: task.title,
              day: currentDay,
              startTime: minutesToTime(startMin),
              endTime: minutesToTime(endMin),
              duration: reqHours
            });

            // Lock this slot for future auto-scheduled tasks
            for (let m = startMin; m < endMin; m++) {
              occupancy[m] = true;
            }

            isScheduled = true;
            break;
          }
        }
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

    // Fetch existing saved schedule from Supabase
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

    // Generate clean non-overlapping schedule from database tasks + routines
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
      const generated = generateStrictNonOverlappingSchedule(userTasks, routineActivities);
      setSchedule(generated);

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