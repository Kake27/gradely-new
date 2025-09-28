"use client";

import ProtectedRoute from "@/app/context/ProtectedRoute";
import { UserContext } from "@/app/context/ContextProvider";

import { useContext, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

import toast, {Toaster} from "react-hot-toast";
import { ArrowLeft, Users, BookOpen, ClipboardList, Upload, Plus, X, Calendar, CheckCircle,Clock, Menu, 
         UserPlus, Paperclip, FileText, Eye, Edit} from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
}


export default function FacultyCourse() {
    const router = useRouter();
    const { user, loading } = useContext(UserContext);

    const { courseId } = useParams(); 
  
    // Course Data
    const [courseData, setCourseData] = useState<{
        name: string;
        [key: string]: any; 
    } | null>(null);

    const [students, setStudents] = useState<any[]>([]);
    const [tas, setTas] = useState<any[]>([]);

    // Page State
    const [activeTab, setActiveTab] = useState("assignments");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
    const [participantType, setParticipantType] = useState("student");
    const [showSidebar, setShowSidebar] = useState(false);
    const [showPdfViewer, setShowPdfViewer] = useState(false);

    // Assignments
    const [uploading, setUploading] = useState(false);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [assignmentForm, setAssignmentForm] = useState({
        name: "",
        description: "",
        dueDate: "",
        maxPoints: "",
        pdfFile: null as File | null, // ✅ Next.js-friendly
    });

    // Participants
    const [participantForm, setParticipantForm] = useState({ email: "" });
    const [selectedPdfUrl, setSelectedPdfUrl] = useState("");

    // Submission data
    const [gradedSubmissions, setGradedSubmissions] = useState<any[]>([]);
    const [ungradedSubmissions, setUngradedSubmissions] = useState<any[]>([]);

    const PdfViewer: React.FC<PdfViewerProps> = ({ pdfUrl }) => {
        return (
            <iframe
            src={pdfUrl}
            title="Assignment PDF"
            width="100%"
            height="600px"
            style={{ border: "none", borderRadius: "8px" }}
            ></iframe>
        );
    };


    const handleBack = () => {
        router.push("/faculty");
    };

    const handleCreateAssignment = async () => {
        if (!assignmentForm.name.trim() || !assignmentForm.dueDate) return;

        let pdfUrl = "";
        let publicId = "";

        if (assignmentForm.pdfFile) {
        const formData = new FormData();
        formData.append("file", assignmentForm.pdfFile);

        const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });
        if (!uploadRes.ok) {
            toast.error("Failed to upload PDF");
            return;
        }
        const uploadData = await uploadRes.json();
        pdfUrl = uploadData.secureUrl;
        publicId = uploadData.publicId;
        }

    const newAssignment = {
      title: assignmentForm.name.trim(),
      description: assignmentForm.description.trim(),
      url: pdfUrl,
      publicId,
      courseId,
      marks: assignmentForm.maxPoints
        ? parseInt(assignmentForm.maxPoints)
        : 100,
      dueDate: assignmentForm.dueDate,
      facultyId: user.id,
    };

    const res = await fetch("/api/assignments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAssignment),
    });

    if (!res.ok) {
      toast.error("Error creating assignment");
      return;
    }

    toast.success("Assignment created successfully");
    setShowCreateModal(false);
    setAssignmentForm({
      name: "",
      description: "",
      dueDate: "",
      maxPoints: "",
      pdfFile: null,
    });

    // refresh assignments
    fetchCourse();
  };

  const handleCancelCreate = () => {
    setAssignmentForm({
        name: "",
        description: "",
        dueDate: "",
        maxPoints: "",
        pdfFile: null,   
    });
    setShowCreateModal(false);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "application/pdf") {
            setAssignmentForm((prev) => ({
            ...prev,
            pdfFile: file, // ✅ store file in state
            }));
        } else if (file) {
            toast.error("Please select a PDF file only.");
            event.target.value = ""; // reset input
        }
    };

    const handleAddParticipant = async () => {
        const email = participantForm.email.trim();
        if (!email) return;

        try {
            if (participantType === "ta") {
            // Get TA ID
            const res = await fetch(`/api/ta/getTAID?email=${encodeURIComponent(email)}`);
            const taId = await res.json();

            if (!taId) {
                toast.error("This user hasn't registered yet!");
                return;
            }

            // Add TA to course
            const courseRes = await fetch(`/api/course/addTA`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, taId }),
            });
            const courseData = await courseRes.json();

            if (courseData.error) {
                toast("This TA has already been added!", { icon: "⚠️" });
                return;
            }

            // Add course to TA
            await fetch(`/api/ta/addCourse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, taId }),
            });

            toast.success("Added TA successfully to the course!");
            } else {
            // Get Student ID
            const res = await fetch(`/api/student/getStudentID?email=${encodeURIComponent(email)}`);
            const studentId = await res.json();

            if (!studentId) {
                toast.error("This user hasn't registered yet!");
                return;
            }

            // Add student to course
            const courseRes = await fetch(`/api/course/addStudent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, studentId }),
            });
            const courseData = await courseRes.json();

            if (courseData.error) {
                toast("This student has already been added!", { icon: "⚠️" });
                return;
            }

            // Add course to student
            await fetch(`/api/student/addCourse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, studentId }),
            });

            toast.success("Added student successfully to the course!");
            }

            setParticipantForm({ email: "" });
            setShowAddParticipantModal(false);
        } catch (err) {
            console.error("Error accessing DB", err);
        }
    };

    const handleCancelAddParticipant = () => {
        setParticipantForm({ email: "" }); 
        setShowAddParticipantModal(false);
    };

    const openAddParticipantModal = (type: "student" | "ta") => {
        setParticipantType(type);
        setShowAddParticipantModal(true);
    };


    // PDF Viewing Functionality
    const handleViewPdf = (pdfUrl: string) => {
        setSelectedPdfUrl(pdfUrl);
        setShowPdfViewer(true);
    };

    const handleClosePdfViewer = () => {
        setShowPdfViewer(false);
        setSelectedPdfUrl("");
    };

    // Grade color utility
    const getGradeColor = (grade: string) => {
        if (grade.startsWith("A")) return "text-green-600 bg-green-100";
        if (grade.startsWith("B")) return "text-blue-600 bg-blue-100";
        if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-100";
        return "text-red-600 bg-red-100";
    };

  const handleGradeSubmission = (
    submissionId: string,
    assignmentId: string
  ) => {
    router.push(
      `/checkSubmission/${assignmentId}/${submissionId}?returnPath=${encodeURIComponent(
        window.location.pathname
      )}&role=faculty`
    );
  };

  const fetchCourse = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}?role=faculty`, {
        method: "GET",
      });
      if (!res.ok) {
        router.push("/unauthorized");
        return;
      }
      const data = await res.json();

      // confirm that current user is the faculty
      if (data.faculty._id !== user.id) {
        router.push("/unauthorized");
        return;
      }

      setCourseData(data);
      setTas(data.tas);
      setStudents(data.students);

      setAssignments(data.assignments);
      setGradedSubmissions(
        data.assignments.flatMap((a: any) =>
          a.gradedSubmissions.map((s: any) => ({
            ...s,
            assignmentName: a.title,
            assignmentDueDate: a.dueDate,
            maxMarks: a.marks,
          }))
        )
      );
      setUngradedSubmissions(
        data.assignments.flatMap((a: any) =>
          a.ungradedSubmissions.map((s: any) => ({
            ...s,
            assignmentName: a.title,
            assignmentDueDate: a.dueDate,
            maxMarks: a.marks,
          }))
        )
      );
    } catch (err) {
      console.error("Error fetching course:", err);
      router.push("/unauthorized");
    }
  };

  useEffect(() => {
    if (!loading && user) fetchCourse();
  }, [loading, user, courseId]);
    return (
        <ProtectedRoute roles={["faculty"]}>
            <div className="min-h-screen bg-gray-50">
            <Toaster />
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to Dashboard
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{courseData?.name || "Loading..."}</h1>
                        <p className="text-gray-600">Course Management</p>
                    </div>
                    </div>
                    
                    {/* Mobile sidebar toggle */}
                    <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="lg:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                    <Menu className="h-5 w-5" />
                    Participants
                    </button>
                </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-6">
                {/* Main Content */}
                <div className="flex-1">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                        onClick={() => setActiveTab('assignments')}
                        className={`${
                            activeTab === 'assignments'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                        <ClipboardList className="h-5 w-5" />
                        Assignments ({assignments.length})
                        </button>
                        <button
                        onClick={() => setActiveTab('submissions')}
                        className={`${
                            activeTab === 'submissions'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                        <Upload className="h-5 w-5" />
                        Submissions ({gradedSubmissions.length + ungradedSubmissions.length})
                        </button>
                    </nav>
                    </div>

                    {/* Content */}
                    {activeTab === 'assignments' ? (
                    <div>
                        {/* Create Assignment Button */}
                        <div className="mb-6 flex justify-between items-center">
                        <h2 className="text-2xl font-semibold text-gray-900">Course Assignments</h2>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Plus className="h-5 w-5" />
                            Upload Assignment
                        </button>
                        </div>

                        {/* Assignments List */}
                        <div className="space-y-4">
                        {assignments.map((assignment) => (
                            <div key={assignment._id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{assignment.title}</h3>
                                <p className="text-gray-600 mb-3">{assignment.description}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                    </span>
                                    <span>Max Points: {assignment.marks}</span>
                                    <span>Submissions: {assignment.gradedSubmissions?.length + assignment.ungradedSubmissions?.length}/{students.length}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {assignment.url && (
                                    <div className="flex items-center gap-2 text-sm text-blue-600">
                                        <FileText className="h-4 w-4" />
                                        <span>Assignment PDF: {assignment.title}</span>
                                    </div>
                                    )}
                                    {assignment.url && (
                                    <button
                                        onClick={() => handleViewPdf(assignment.url)}
                                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                                    >
                                        <Eye className="h-4 w-4" />
                                        View PDF
                                    </button>
                                    )}
                                </div>
                                </div>
                                <div className="ml-4">
                                <div className="w-24 bg-gray-200 rounded-full h-2 mb-1">
                                    <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${(assignment.gradedSubmissions?.length+assignment.ungradedSubmissions?.length / students.length) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {Math.round((assignment.gradedSubmissions?.length+assignment.ungradedSubmissions?.length / students.length) * 100)}% submitted
                                </span>
                                </div>
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>
                    ) : (
                    <div>
                        <div className="space-y-8">
                        {/* Graded Submissions */}
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            Graded Submissions ({gradedSubmissions.length})
                            </h2>
                            
                            {gradedSubmissions.length > 0 ? (
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-green-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Student
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Assignment
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Submitted
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Grade
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Graded By
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Graded Date
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {gradedSubmissions.map((submission) => (
                                        <tr key={submission._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {submission.student?.name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {submission.student?.email}
                                            </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {submission.assignmentName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {submission.filename || 'submission.pdf'}
                                            </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {new Date(submission.submittedDate).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full w-fit ${getGradeColor(submission.grade)}`}>
                                                {submission.grade}
                                            </span>
                                            <span className="text-xs text-gray-500 mt-1">
                                                {submission.marks} / {submission.maxMarks} pts
                                            </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {submission.gradedBy?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {submission.checkedDate ? new Date(submission.checkedDate).toLocaleDateString() : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button 
                                            onClick={() => handleGradeSubmission(submission._id, submission.assignment)}
                                            className="flex items-center gap-2 px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                                            >
                                            <Edit className="h-3 w-3" />
                                            Change Grade
                                            </button>
                                        </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            ) : (
                            <div className="bg-white rounded-lg shadow p-8 text-center">
                                <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Graded Submissions</h3>
                                <p className="text-gray-500">No submissions have been graded yet.</p>
                            </div>
                            )}
                        </div>
                        
                        {/* Ungraded Submissions */}
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="h-6 w-6 text-yellow-500" />
                            Pending Review ({ungradedSubmissions.length})
                            </h2>
                            
                            {ungradedSubmissions.length > 0 ? (
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-yellow-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Student
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Assignment
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Submitted
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Max Points
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {ungradedSubmissions.map((submission) => (
                                        <tr key={submission._id || submission.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {submission.student?.name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {submission.student?.email || submission.studentEmail}
                                            </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {submission.assignmentName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {submission.filename || 'submission.pdf'}
                                            </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {new Date(submission.submittedDate || submission.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {submission.maxMarks} pts
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full text-yellow-600 bg-yellow-100">
                                            <Clock className="h-3 w-3" />
                                            Awaiting Review
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button 
                                            onClick={() => handleGradeSubmission(submission._id, submission.assignment)}
                                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                            Grade
                                            </button>
                                        </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            ) : (
                            <div className="bg-white rounded-lg shadow p-8 text-center">
                                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Submissions</h3>
                                <p className="text-gray-500">All submissions have been reviewed and graded.</p>
                            </div>
                            )}
                        </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Sidebar - Desktop */}
                <div className="hidden lg:block w-80 bg-white rounded-lg shadow p-6 h-fit sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Participants</h3>
                    
                    {/* TAs Section */}
                    <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium text-gray-900">Teaching Assistants ({tas.length})</h4>
                        </div>
                        <button
                        onClick={() => openAddParticipantModal('ta')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                        >
                        <UserPlus className="h-3 w-3" />
                        Add TA
                        </button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {tas.map((ta) => (
                        <div key={ta._id} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {ta.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{ta.name}</p>
                            <p className="text-xs text-gray-500 truncate">{ta.email}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>

                    {/* Students Section */}
                    <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium text-gray-900">Students ({students.length})</h4>
                        </div>
                        <button
                        onClick={() => openAddParticipantModal('student')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                        >
                        <UserPlus className="h-3 w-3" />
                        Add Student
                        </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {students.map((student) => (
                        <div key={student._id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {student.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>
                </div>

                {/* Mobile Sidebar */}
                {showSidebar && (
                    <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowSidebar(false)}>
                    <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Course Participants</h3>
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        </div>
                        
                        {/* TAs Section */}
                        <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900">Teaching Assistants ({tas.length})</h4>
                            </div>
                            <button
                            onClick={() => openAddParticipantModal('ta')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                            >
                            <UserPlus className="h-3 w-3" />
                            Add TA
                            </button>
                        </div>
                        <div className="space-y-2">
                            {tas.map((ta) => (
                            <div key={ta._id} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {ta.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{ta.name}</p>
                                <p className="text-xs text-gray-500 truncate">{ta.email}</p>
                                </div>
                            </div>
                            ))}
                        </div>
                        </div>

                        {/* Students Section */}
                        <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-green-600" />
                            <h4 className="font-medium text-gray-900">Students ({students.length})</h4>
                            </div>
                            <button
                            onClick={() => openAddParticipantModal('student')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                            >
                            <UserPlus className="h-3 w-3" />
                            Add Student
                            </button>
                        </div>
                        <div className="space-y-2">
                            {students.map((student) => (
                            <div key={student._id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {student.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                                <p className="text-xs text-gray-500 truncate">{student.email}</p>
                                </div>
                            </div>
                            ))}
                        </div>
                        </div>
                    </div>
                    </div>
                )}
                </div>
            </div>

            {/* PDF Viewer Modal */}
            {showPdfViewer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Assignment PDF</h3>
                    <button
                        onClick={handleClosePdfViewer}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                    <PdfViewer pdfUrl={selectedPdfUrl} />
                    </div>
                </div>
                </div>
            )}

            {/* Create Assignment Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50  flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl h-4/5 max-w-md w-full mx-4 overflow-y-scroll">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Upload New Assignment</h3>
                    <button
                        onClick={handleCancelCreate}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="assignmentName" className="block text-sm font-medium text-gray-700 mb-2">
                        Assignment Name *
                        </label>
                        <input
                        type="text"
                        id="assignmentName"
                        value={assignmentForm.name}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, name: e.target.value })}
                        placeholder="Enter assignment name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="assignmentDescription" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                        </label>
                        <textarea
                        id="assignmentDescription"
                        value={assignmentForm.description}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                        placeholder="Enter assignment description"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date 
                        </label>
                        <input
                        type="date"
                        id="dueDate"
                        value={assignmentForm.dueDate}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="maxPoints" className="block text-sm font-medium text-gray-700 mb-2">
                        Marks * 
                        </label>
                        <input
                        type="number"
                        id="maxPoints"
                        value={assignmentForm.maxPoints}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })}
                        placeholder="Enter maximum points"
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label htmlFor="pdfFile" className="block text-sm font-medium text-gray-700 mb-2">
                        Assignment PDF
                        </label>
                        <div className="relative">
                        <input
                            type="file"
                            id="pdfFile"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <label
                            htmlFor="pdfFile"
                            className="flex items-center justify-center w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                            <div className="text-center">
                            <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                                {assignmentForm.pdfFile ? assignmentForm.pdfFile.name : 'Click to upload PDF file'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">PDF files only</p>
                            </div>
                        </label>
                        </div>
                        {assignmentForm.pdfFile && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                            <FileText className="h-4 w-4" />
                            <span>File selected: {assignmentForm.pdfFile.name}</span>
                            <button
                            onClick={() => setAssignmentForm({ ...assignmentForm, pdfFile: null })}
                            className="text-red-500 hover:text-red-700"
                            >
                            <X className="h-4 w-4" />
                            </button>
                        </div>
                        )}
                    </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={handleCancelCreate}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateAssignment}
                        disabled={!assignmentForm.name.trim() || !assignmentForm.dueDate || !assignmentForm.maxPoints}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {uploading ? (  <span className="inline-block w-5 h-5 border-2 border-white border-t-blue-500 rounded-full animate-spin"></span>) : 'Upload Assignment'}
                    </button>
                    </div>
                </div>
                </div>
            )}

            {/* Add Participant Modal */}
            {showAddParticipantModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Add {participantType === 'ta' ? 'Teaching Assistant' : 'Student'}
                    </h3>
                    <button
                        onClick={handleCancelAddParticipant}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="participantEmail" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                        </label>
                        <input
                        type="email"
                        id="participantEmail"
                        required
                        value={participantForm.email}
                        onChange={(e) => setParticipantForm({ ...participantForm, email: e.target.value })}
                        placeholder={`Enter ${participantType === 'ta' ? 'TA' : 'student'} email`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">
                        {participantType === 'ta' 
                            ? 'The TA will be added to the course and will be able to grade assignments and assist students.'
                            : 'The student will be enrolled in the course and will be able to view assignments and submit their work.'
                        }
                        </p>
                    </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={handleCancelAddParticipant}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleAddParticipant}
                        disabled={!participantForm.email.trim()}
                        className={`px-4 py-2 text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${
                        participantType === 'ta' 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}>
                        Add {participantType === 'ta' ? 'TA' : 'Student'}
                    </button>
                    </div>
                </div>
                </div>
            )}
            </div>
        </ProtectedRoute>
    )
}