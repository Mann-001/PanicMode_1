
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Edit, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface RoutineActivity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Task {
  id: string;
  name: string;
  deadline: Date;
  weightage: number;
  totalTime?: number;
  dailyTime?: number;
}

interface ScheduleItem {
  id: string;
  taskId: string;
  taskName: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
}

const ScheduleGenerator = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routine, setRoutine] = useState<RoutineActivity[]>([]);
  const navigate = useNavigate();

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Load tasks
    const savedTasks = localStorage.getItem("panicmode_tasks");
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks);
      const tasksWithDates = parsedTasks.map((task: any) => ({
        ...task,
        deadline: new Date(task.deadline)
      }));
      setTasks(tasksWithDates);
    }

    // Load routine
    const savedRoutine = localStorage.getItem("panicmode_routine");
    if (savedRoutine) {
      setRoutine(JSON.parse(savedRoutine));
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      generateSchedule();
    }
  }, [tasks, routine]);

  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const isTimeSlotFree = (day: string, startMinutes: number, endMinutes: number) => {
    // Check against routine activities
    for (const activity of routine) {
      const activityStart = timeToMinutes(activity.startTime);
      const activityEnd = timeToMinutes(activity.endTime);
      
      if (!(endMinutes <= activityStart || startMinutes >= activityEnd)) {
        return false;
      }
    }

    // Check against existing schedule
    const daySchedule = schedule.filter(item => item.day === day);
    for (const item of daySchedule) {
      const itemStart = timeToMinutes(item.startTime);
      const itemEnd = timeToMinutes(item.endTime);
      
      if (!(endMinutes <= itemStart || startMinutes >= itemEnd)) {
        return false;
      }
    }

    return true;
  };

  const findAvailableSlot = (day: string, durationMinutes: number) => {
    const workingHoursStart = 8 * 60; // 8 AM
    const workingHoursEnd = 22 * 60; // 10 PM
    
    for (let start = workingHoursStart; start <= workingHoursEnd - durationMinutes; start += 30) {
      const end = start + durationMinutes;
      if (isTimeSlotFree(day, start, end)) {
        return { start, end };
      }
    }
    return null;
  };

  const generateSchedule = () => {
    const newSchedule: ScheduleItem[] = [];
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday

    // Sort tasks by priority (higher weightage first) and deadline
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.weightage !== b.weightage) {
        return b.weightage - a.weightage;
      }
      return a.deadline.getTime() - b.deadline.getTime();
    });

    for (const task of sortedTasks) {
      const daysUntilDeadline = Math.max(1, differenceInDays(task.deadline, today));
      let totalTimeNeeded = task.totalTime || (task.dailyTime! * daysUntilDeadline);
      let scheduledTime = 0;

      // Try to schedule the task across available days
      for (let dayIndex = 0; dayIndex < daysUntilDeadline && dayIndex < 7 && scheduledTime < totalTimeNeeded; dayIndex++) {
        const currentDay = daysOfWeek[dayIndex];
        
        // Determine session duration (1-3 hours based on remaining time)
        let sessionHours = Math.min(2, totalTimeNeeded - scheduledTime);
        if (task.dailyTime) {
          sessionHours = Math.min(task.dailyTime, totalTimeNeeded - scheduledTime);
        }
        
        const sessionMinutes = sessionHours * 60;
        const slot = findAvailableSlot(currentDay, sessionMinutes);
        
        if (slot) {
          const scheduleItem: ScheduleItem = {
            id: `${task.id}-${dayIndex}`,
            taskId: task.id,
            taskName: task.name,
            day: currentDay,
            startTime: minutesToTime(slot.start),
            endTime: minutesToTime(slot.end),
            duration: sessionHours
          };
          
          newSchedule.push(scheduleItem);
          scheduledTime += sessionHours;
        }
      }
    }

    setSchedule(newSchedule);
    localStorage.setItem("panicmode_schedule", JSON.stringify(newSchedule));
    
    if (newSchedule.length > 0) {
      toast({
        title: "Schedule Generated!",
        description: `${newSchedule.length} study sessions planned`,
      });
    }
  };

  const handleRegenerateSchedule = () => {
    setSchedule([]);
    setTimeout(() => {
      generateSchedule();
    }, 100);
  };

  const getTaskColor = (taskId: string) => {
    const colors = [
      'bg-teal-100 border-teal-300',
      'bg-blue-100 border-blue-300',
      'bg-green-100 border-green-300',
      'bg-purple-100 border-purple-300',
      'bg-orange-100 border-orange-300',
    ];
    const index = parseInt(taskId.slice(-1)) % colors.length;
    return colors[index];
  };

  if (tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 flex items-center justify-center p-4">
        <Card className="max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center p-8">
            <h2 className="text-2xl font-bold text-teal-600 mb-4">No Tasks Found</h2>
            <p className="text-gray-600 mb-6">
              You need to add tasks before we can generate a schedule.
            </p>
            <Button 
              onClick={() => navigate("/tasks")}
              className="bg-teal-500 hover:bg-teal-600"
            >
              Add Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            Your Smart Study Schedule
          </h1>
          <p className="text-gray-600">
            Based on your routine and task priorities
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Button 
            onClick={handleRegenerateSchedule}
            className="bg-teal-500 hover:bg-teal-600"
          >
            Regenerate Plan
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate("/reschedule")}
            className="border-teal-300 text-teal-600 hover:bg-teal-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Reschedule
          </Button>
        </div>

        {schedule.length === 0 ? (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="text-center p-8">
              <p className="text-gray-600">
                No schedule generated yet. This might happen if your routine takes up most of your available time.
                Try adjusting your routine or task requirements.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {daysOfWeek.map(day => {
              const daySchedule = schedule.filter(item => item.day === day);
              const dayRoutine = routine.filter(() => true); // Show routine for context
              
              return (
                <Card key={day} className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-teal-600 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {day}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Show routine activities in muted style */}
                    {dayRoutine.map(activity => (
                      <div 
                        key={activity.id}
                        className="p-2 bg-gray-100 rounded border border-gray-200 text-sm"
                      >
                        <div className="font-medium text-gray-600">{activity.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.startTime} - {activity.endTime}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show study sessions */}
                    {daySchedule.length === 0 ? (
                      <p className="text-gray-500 text-sm py-4">No study sessions</p>
                    ) : (
                      daySchedule.map(item => (
                        <div 
                          key={item.id}
                          className={`p-3 rounded-lg border-2 ${getTaskColor(item.taskId)}`}
                        >
                          <div className="font-medium text-gray-800">{item.taskName}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {item.startTime} - {item.endTime}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.duration} hour{item.duration !== 1 ? 's' : ''}
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
