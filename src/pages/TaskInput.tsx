import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Calendar as CalendarIcon, Edit, Trash2, Pin, Clock, Loader2 } from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

interface Task {
  id: string;
  user_id: string;
  title: string;
  task_type: "auto_scheduled" | "pinned";
  deadline?: string | null;
  priority?: number | null;
  time_mode?: "total" | "daily" | null;
  hours_required?: number | null;
  pinned_datetime?: string | null;
  notification_offset?: number | null;
}

const formatDateSafely = (date: Date | string | undefined): string => {
  if (!date) return "No date set";
  const parsed = new Date(date);
  return isValid(parsed) ? format(parsed, "PPP p") : "Invalid date";
};

const TaskInput = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [taskCategory, setTaskCategory] = useState<"auto_scheduled" | "pinned">("auto_scheduled");

  const [newTask, setNewTask] = useState({
    title: "",
    deadline: undefined as Date | undefined,
    priority: "5" as string | number,
    hoursRequired: "",
    timeMode: "total" as "total" | "daily",
    pinnedDateTime: "",
    notificationOffset: 10
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTasks = async () => {
    setFetching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFetching(false);
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Failed to load tasks",
        description: error.message,
        variant: "destructive"
      });
    } else if (data) {
      setTasks(data);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSaveTask = async () => {
    if (!newTask.title.trim()) {
      toast({ title: "Please enter a task title", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);

    let payload: any = {
      user_id: user.id,
      title: newTask.title.trim(),
      task_type: taskCategory,
    };

    if (taskCategory === "auto_scheduled") {
      if (!newTask.deadline) {
        toast({ title: "Deadline is required for auto-scheduled tasks", variant: "destructive" });
        setLoading(false);
        return;
      }
      const parsedHours = parseFloat(newTask.hoursRequired);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        toast({ title: "Please enter valid required hours", variant: "destructive" });
        setLoading(false);
        return;
      }

      const parsedPriority = Number(newTask.priority);
      payload.deadline = newTask.deadline.toISOString();
      payload.priority = isNaN(parsedPriority) ? 5 : Math.min(10, Math.max(1, parsedPriority));
      payload.time_mode = newTask.timeMode;
      payload.hours_required = parsedHours;
      payload.pinned_datetime = null;
      payload.notification_offset = null;
    } else {
      if (!newTask.pinnedDateTime) {
        toast({ title: "Please select date and time for pinned reminder", variant: "destructive" });
        setLoading(false);
        return;
      }

      payload.pinned_datetime = new Date(newTask.pinnedDateTime).toISOString();
      payload.notification_offset = newTask.notificationOffset;
      payload.deadline = null;
      payload.priority = null;
      payload.time_mode = null;
      payload.hours_required = null;
    }

    if (isEditing) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", isEditing);
      if (error) {
        toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Task updated!" });
        setIsEditing(null);
      }
    } else {
      const { error } = await supabase.from("tasks").insert([payload]);
      if (error) {
        toast({ title: "Failed to save task", description: error.message, variant: "destructive" });
      } else {
        toast({ title: taskCategory === "pinned" ? "Pinned reminder saved!" : "Auto-scheduled task saved!" });
      }
    }

    setLoading(false);
    setNewTask({
      title: "",
      deadline: undefined,
      priority: "5",
      hoursRequired: "",
      timeMode: "total",
      pinnedDateTime: "",
      notificationOffset: 10
    });
    fetchTasks();
  };

  const handleEditTask = (task: Task) => {
    setTaskCategory(task.task_type || "auto_scheduled");
    setNewTask({
      title: task.title,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      priority: task.priority?.toString() || "5",
      hoursRequired: task.hours_required?.toString() || "",
      timeMode: task.time_mode || "total",
      pinnedDateTime: task.pinned_datetime ? format(new Date(task.pinned_datetime), "yyyy-MM-dd'T'HH:mm") : "",
      notificationOffset: task.notification_offset || 10
    });
    setIsEditing(task.id);
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task removed" });
      fetchTasks();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-600 mb-2">
            What do you need to get done?
          </h1>
          <p className="text-gray-600">
            Auto-schedule flexible tasks or pin one-off commitments to fixed times
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Add / Edit Form */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <Plus className="h-5 w-5" />
                {isEditing ? "Edit Task" : "Add Task"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PRD Question: Auto-schedule or Pin? */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Task Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={taskCategory === "auto_scheduled" ? "default" : "outline"}
                    onClick={() => setTaskCategory("auto_scheduled")}
                    className={cn(
                      "flex items-center gap-2",
                      taskCategory === "auto_scheduled" ? "bg-teal-600 hover:bg-teal-700" : "border-teal-200"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    Auto-Schedule
                  </Button>
                  <Button
                    type="button"
                    variant={taskCategory === "pinned" ? "default" : "outline"}
                    onClick={() => setTaskCategory("pinned")}
                    className={cn(
                      "flex items-center gap-2",
                      taskCategory === "pinned" ? "bg-teal-600 hover:bg-teal-700" : "border-teal-200"
                    )}
                  >
                    <Pin className="h-4 w-4" />
                    Pinned Reminder
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Task Title *
                </label>
                <Input
                  placeholder={taskCategory === "pinned" ? "e.g., Take medicine, Call advisor" : "e.g., Math Exam Prep"}
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

              {taskCategory === "auto_scheduled" ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Deadline *
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-teal-200",
                            !newTask.deadline && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatDateSafely(newTask.deadline)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newTask.deadline}
                          onSelect={(date) => setNewTask({ ...newTask, deadline: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Priority (1-10)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      className="border-teal-200 focus:border-teal-400"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 block">
                      Time Requirement *
                    </label>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="radio"
                          name="timeMode"
                          checked={newTask.timeMode === "total"}
                          onChange={() => setNewTask({ ...newTask, timeMode: "total" })}
                          className="accent-teal-500"
                        />
                        Total Hours
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="radio"
                          name="timeMode"
                          checked={newTask.timeMode === "daily"}
                          onChange={() => setNewTask({ ...newTask, timeMode: "daily" })}
                          className="accent-teal-500"
                        />
                        Daily Hours
                      </label>
                    </div>

                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      placeholder={newTask.timeMode === "total" ? "Total study hours needed" : "Daily hours needed"}
                      value={newTask.hoursRequired}
                      onChange={(e) => setNewTask({ ...newTask, hoursRequired: e.target.value })}
                      className="border-teal-200 focus:border-teal-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Exact Date & Time *
                    </label>
                    <Input
                      type="datetime-local"
                      value={newTask.pinnedDateTime}
                      onChange={(e) => setNewTask({ ...newTask, pinnedDateTime: e.target.value })}
                      className="border-teal-200 focus:border-teal-400"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Notification Offset
                    </label>
                    <select
                      value={newTask.notificationOffset}
                      onChange={(e) => setNewTask({ ...newTask, notificationOffset: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-md border border-teal-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      <option value={0}>At time of event</option>
                      <option value={10}>10 minutes before</option>
                      <option value={30}>30 minutes before</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveTask}
                  disabled={loading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600"
                >
                  {loading ? "Saving..." : isEditing ? "Update Task" : "Add Task"}
                </Button>
                {isEditing && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditing(null);
                      setNewTask({
                        title: "",
                        deadline: undefined,
                        priority: "5",
                        hoursRequired: "",
                        timeMode: "total",
                        pinnedDateTime: "",
                        notificationOffset: 10
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <CalendarIcon className="h-5 w-5" />
                Your Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fetching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks saved in your database yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {task.task_type === "pinned" ? (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                              <Pin className="h-3 w-3" /> Pinned
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700 rounded flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Auto
                            </span>
                          )}
                          <h4 className="font-medium text-gray-800">{task.title}</h4>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTask(task)}
                            className="text-teal-600 hover:bg-teal-100 p-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-500 hover:bg-red-50 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-0.5 mt-2">
                        {task.task_type === "pinned" ? (
                          <>
                            <p>Pinned Time: <span className="font-semibold">{formatDateSafely(task.pinned_datetime || undefined)}</span></p>
                            <p>Notify: <span className="font-semibold">{task.notification_offset === 0 ? "At event" : `${task.notification_offset} mins before`}</span></p>
                          </>
                        ) : (
                          <>
                            <p>Time Required: <span className="font-semibold">{task.hours_required} hrs ({task.time_mode})</span></p>
                            <p>Due: {formatDateSafely(task.deadline || undefined)}</p>
                            <p>Priority: {task.priority ?? "N/A"}/10</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button 
            onClick={() => navigate("/schedule")}
            className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-3 text-lg rounded-xl shadow-lg transition-all"
          >
            Generate Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskInput;