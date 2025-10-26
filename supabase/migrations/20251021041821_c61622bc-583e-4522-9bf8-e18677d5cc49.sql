-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin');

-- Create enum for exam section types
CREATE TYPE public.section_type AS ENUM ('mcq', 'theoretical', 'practical');

-- Create enum for candidate session status
CREATE TYPE public.session_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Create profiles table for admin users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  rotation_slot INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exams" ON public.exams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active exams" ON public.exams
  FOR SELECT USING (is_active = true);

-- Create exam_sections table
CREATE TABLE public.exam_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  section_type section_type NOT NULL,
  section_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  timer_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sections" ON public.exam_sections
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view sections" ON public.exam_sections
  FOR SELECT USING (true);

-- Create exam_questions table
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.exam_sections(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  options JSONB,
  correct_answer TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage questions" ON public.exam_questions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view questions" ON public.exam_questions
  FOR SELECT USING (true);

-- Create candidate_sessions table
CREATE TABLE public.candidate_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT NOT NULL,
  gender TEXT,
  exam_location TEXT NOT NULL,
  custom_location TEXT,
  status session_status NOT NULL DEFAULT 'in_progress',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  recording_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  flags JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.candidate_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all sessions" ON public.candidate_sessions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert session" ON public.candidate_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Candidates can update own session" ON public.candidate_sessions
  FOR UPDATE USING (true);

-- Create candidate_answers table
CREATE TABLE public.candidate_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.candidate_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.exam_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT,
  selected_option TEXT,
  code_submission JSONB,
  is_auto_saved BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all answers" ON public.candidate_answers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert answers" ON public.candidate_answers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Candidates can update own answers" ON public.candidate_answers
  FOR UPDATE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();