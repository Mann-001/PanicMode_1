import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Calendar as CalendarIcon, Edit, Trash2 } from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

interface Task {
  id: string;
  user_id: string;
  title: string;
  task_type: string;
  deadline?: string | null;
  priority?: number | null;
  total_time?: number | null;
  daily_time?: number | null;
}

const formatDateSafely = (date: Date | string | undefined): string => {
  if (!date) return "No date set";
  const parsed = new Date(date);
  return isValid(parsed) ? format(parsed, "PPP") : "Invalid date";
};

const TaskInput = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    deadline: undefined as Date | undefined,
    priority: "5" as string | number,
    timeHours: "", // Unified input field for hours
    timeType: "total" as "total" | "daily"
  });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSaveTask = async () => {
    if (!newTask.title.trim() || !newTask.deadline) {
      toast({
        title: "Please fill in required fields",
        description: "Task title and deadline are required",
        variant: "destructive",
      });
      return;
    }

    const parsedHours = parseFloat(newTask.timeHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      toast({
        title: "Please enter valid time hours",
        description: "Specify a positive number of hours",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);

    const parsedPriority = Number(newTask.priority);
    const finalPriority = isNaN(parsedPriority) || parsedPriority < 1 ? 5 : Math.min(10, parsedPriority);

    const payload = {
      user_id: user.id,
      title: newTask.title.trim(),
      task_type: "auto_scheduled",
      deadline: newTask.deadline.toISOString(),
      priority: finalPriority,
      total_time: newTask.timeType === "total" ? parsedHours : null,
      daily_time: newTask.timeType === "daily" ? parsedHours : null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", isEditing);

      if (error) {
        toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Task updated!" });
        setIsEditing(null);
      }
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert([payload]);

      if (error) {
        toast({ title: "Failed to save task", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Task saved!" });
      }
    }

    setLoading(false);
    setNewTask({
      title: "",
      deadline: undefined,
      priority: "5",
      timeHours: "",
      timeType: "total"
    });
    fetchTasks();
  };

  const handleEditTask = (task: Task) => {
    setNewTask({
      title: task.title,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      priority: task.priority?.toString() || "5",
      timeHours: (task.total_time || task.daily_time)?.toString() || "",
      timeType: task.total_time ? "total" : "daily"
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
            Manage Your Tasks
          </h1>
          <p className="text-gray-600">
            Add tasks directly to your study planner
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <Plus className="h-5 w-5" />
                {isEditing ? "Edit Task" : "Add Task"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Task Title *
                </label>
                <Input
                  placeholder="e.g., Mathematics Exam Prep"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

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
                      name="timeType"
                      checked={newTask.timeType === "total"}
                      onChange={() => setNewTask({ ...newTask, timeType: "total" })}
                      className="accent-teal-500"
                    />
                    Total Hours
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="radio"
                      name="timeType"
                      checked={newTask.timeType === "daily"}
                      onChange={() => setNewTask({ ...newTask, timeType: "daily" })}
                      className="accent-teal-500"
                    />
                    Daily Hours
                  </label>
                </div>

                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder={newTask.timeType === "total" ? "Total study hours needed" : "Daily hours needed"}
                  value={newTask.timeHours}
                  onChange={(e) => setNewTask({ ...newTask, timeHours: e.target.value })}
                  className="border-teal-200 focus:border-teal-400"
                />
              </div>

              <div className="flex gap-2">
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
                        timeHours: "",
                        timeType: "total"
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-600">
                <CalendarIcon className="h-5 w-5" />
                Cloud Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks saved in your database yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-gray-800">{task.title}</h4>
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
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>Time: <span className="font-semibold">{task.total_time ? `${task.total_time} hrs Total` : `${task.daily_time} hrs/day`}</span></p>
                        <p>Due: {formatDateSafely(task.deadline || undefined)}</p>
                        <p>Priority: {task.priority ?? "N/A"}</p>
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