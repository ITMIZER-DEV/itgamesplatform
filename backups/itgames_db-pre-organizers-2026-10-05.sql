--
-- PostgreSQL database dump
--

\restrict CdFufPWZ0fP5d4rHgnttDUxa59fJAa8E0K1Tykuh1rciw06QdIfBaDnd70Ag2tx

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: GamesRegister; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public."GamesRegister" (
    code integer NOT NULL,
    "categoryId" integer NOT NULL,
    "gameCode" text NOT NULL,
    team text NOT NULL,
    amount double precision,
    status text DEFAULT 'paid'::text,
    "check" boolean DEFAULT false,
    number text
);


ALTER TABLE public."GamesRegister" OWNER TO itgames_user;

--
-- Name: athlete_profiles; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.athlete_profiles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "birthDate" timestamp(3) without time zone,
    gender text,
    "boxOrGym" text,
    "tshirtSize" text,
    "emergencyContact" text,
    "emergencyPhone" text,
    "termsAccepted" boolean DEFAULT true NOT NULL,
    "termsAcceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.athlete_profiles OWNER TO itgames_user;

--
-- Name: games; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games (
    code text NOT NULL,
    name text NOT NULL,
    date text,
    description text,
    location text,
    "Events" integer DEFAULT 0,
    status text DEFAULT 'live'::text,
    foto text,
    "isLowestPointsBetter" boolean DEFAULT false NOT NULL,
    "showTime" boolean DEFAULT true NOT NULL,
    "showWeight" boolean DEFAULT true NOT NULL,
    "showReps" boolean DEFAULT true NOT NULL,
    "showScoreRevision" boolean DEFAULT false NOT NULL,
    "lanesCount" integer DEFAULT 8,
    "eventType" text DEFAULT 'crossfit'::text,
    "organizerId" text
);


ALTER TABLE public.games OWNER TO itgames_user;

--
-- Name: games_audit_logs; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_audit_logs (
    id text NOT NULL,
    "gameCode" text NOT NULL,
    "scoreId" integer,
    "changedBy" text NOT NULL,
    role text NOT NULL,
    action text NOT NULL,
    "oldValue" text,
    "newValue" text,
    reason text,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text
);


ALTER TABLE public.games_audit_logs OWNER TO itgames_user;

--
-- Name: games_category; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_category (
    code integer NOT NULL,
    name text NOT NULL,
    description text,
    standards text,
    amount double precision DEFAULT 0,
    foto text,
    "gamesId" text NOT NULL,
    "maxAthlete" integer DEFAULT 1,
    "genderRule" text DEFAULT 'open'::text,
    "maxIndividualAge" integer,
    "maxTeamSumAge" integer,
    "minIndividualAge" integer,
    "minTeamSumAge" integer,
    "teamType" text DEFAULT 'individual'::text
);


ALTER TABLE public.games_category OWNER TO itgames_user;

--
-- Name: games_events; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_events (
    "idEvent" integer NOT NULL,
    workout integer,
    category integer NOT NULL,
    game text NOT NULL,
    title text NOT NULL,
    description text,
    status boolean DEFAULT true,
    "sumulaTemplate" text
);


ALTER TABLE public.games_events OWNER TO itgames_user;

--
-- Name: games_heat_slots; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_heat_slots (
    id text NOT NULL,
    "heatId" text NOT NULL,
    "laneNumber" integer NOT NULL,
    "teamCode" integer NOT NULL,
    "gameCode" text NOT NULL
);


ALTER TABLE public.games_heat_slots OWNER TO itgames_user;

--
-- Name: games_heats; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_heats (
    id text NOT NULL,
    "gameCode" text NOT NULL,
    "categoryId" integer NOT NULL,
    "workoutCode" integer NOT NULL,
    "heatNumber" integer NOT NULL,
    "startTime" text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL
);


ALTER TABLE public.games_heats OWNER TO itgames_user;

--
-- Name: games_register_athletes; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_register_athletes (
    code integer NOT NULL,
    name text NOT NULL,
    cpf text,
    "check" boolean DEFAULT false,
    team integer NOT NULL,
    game text NOT NULL,
    category integer,
    phonenumber text,
    "birthDate" timestamp(3) without time zone,
    gender text,
    "tshirtSize" text
);


ALTER TABLE public.games_register_athletes OWNER TO itgames_user;

--
-- Name: games_scores; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_scores (
    code integer NOT NULL,
    "idEvent" integer NOT NULL,
    game text NOT NULL,
    category integer NOT NULL,
    "codeTeam" integer NOT NULL,
    "time" text,
    weight text,
    reps text,
    judge text,
    "dateScore" text,
    "dateCheck" text,
    status boolean DEFAULT true,
    photo text,
    "numberTeam" text,
    point double precision,
    rank integer,
    "isWO" boolean DEFAULT false,
    "tieBreakTime" text,
    "penaltySeconds" integer DEFAULT 0,
    "scoreStatus" text DEFAULT 'approved_by_head_judge'::text
);


ALTER TABLE public.games_scores OWNER TO itgames_user;

--
-- Name: games_scores_code_seq; Type: SEQUENCE; Schema: public; Owner: itgames_user
--

CREATE SEQUENCE public.games_scores_code_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.games_scores_code_seq OWNER TO itgames_user;

--
-- Name: games_scores_code_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itgames_user
--

ALTER SEQUENCE public.games_scores_code_seq OWNED BY public.games_scores.code;


--
-- Name: games_workout; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.games_workout (
    code integer NOT NULL,
    type text,
    description text,
    category integer NOT NULL,
    game text NOT NULL,
    title text,
    "timeCap" text,
    foto text,
    status boolean DEFAULT true
);


ALTER TABLE public.games_workout OWNER TO itgames_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: itgames_user
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    cpf text,
    "phoneNumber" text,
    role text DEFAULT 'ATHLETE'::text NOT NULL,
    "tenantOrgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO itgames_user;

--
-- Name: games_scores code; Type: DEFAULT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_scores ALTER COLUMN code SET DEFAULT nextval('public.games_scores_code_seq'::regclass);


--
-- Data for Name: GamesRegister; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public."GamesRegister" (code, "categoryId", "gameCode", team, amount, status, "check", number) FROM stdin;
6340	6	SUMMER2026	CARLOS ALBERT	0	pending	f	#6340
\.


--
-- Data for Name: athlete_profiles; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.athlete_profiles (id, "userId", "birthDate", gender, "boxOrGym", "tshirtSize", "emergencyContact", "emergencyPhone", "termsAccepted", "termsAcceptedAt") FROM stdin;
2f2729e8-c352-4ef7-b626-610dc4ae7526	fd2a87c6-7970-428e-aa0a-19c7ec87947a	1994-06-15 00:00:00	M	CrossFit Imperial Arena	M	Juliana (Esposa)	11955554444	t	2026-10-02 02:29:08.347
c9f27197-5fa7-4d1b-851c-29c8bed71888	0d5ac19f-36f7-4283-a6fb-34eae98c819f	1995-04-20 00:00:00	M	CF Itmizer	G	\N	\N	t	2026-10-05 22:30:53.81
23015141-8a5f-4ed6-8337-68af39051b3e	ea2009f4-b5a7-44be-94c6-95aa5a519ae5	1985-10-30 00:00:00	M	SUMMER CROSS	G	\N	\N	t	2026-10-05 23:05:23.281
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games (code, name, date, description, location, "Events", status, foto, "isLowestPointsBetter", "showTime", "showWeight", "showReps", "showScoreRevision", "lanesCount", "eventType", "organizerId") FROM stdin;
SUMMER2026	SUMMER CROSS 2016 INTERBOX	2026-11-28	testeste	Summer Cross - Trindade / GO	0	live	\N	t	t	t	t	t	6	crossfit	\N
\.


--
-- Data for Name: games_audit_logs; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_audit_logs (id, "gameCode", "scoreId", "changedBy", role, action, "oldValue", "newValue", reason, "timestamp", "ipAddress") FROM stdin;
\.


--
-- Data for Name: games_category; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_category (code, name, description, standards, amount, foto, "gamesId", "maxAthlete", "genderRule", "maxIndividualAge", "maxTeamSumAge", "minIndividualAge", "minTeamSumAge", "teamType") FROM stdin;
1	INICIANTE - DUPLA MASCULINA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	male	\N	\N	\N	\N	duo
2	INICIANTE - DUPLA FEMININA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	female	\N	\N	\N	\N	duo
3	SCALED - DUPLA MASCULINA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	male	\N	\N	\N	\N	duo
4	SCALED - DUPLA FEMININA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	female	\N	\N	\N	\N	duo
5	AMADOR - DUPLA MASCULINA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	male	\N	\N	\N	\N	duo
6	AMADOR - DUPLA MISTA	Regulamento oficial da categoria	\N	150	\N	SUMMER2026	2	mixed_1m_1f	\N	\N	\N	\N	duo
\.


--
-- Data for Name: games_events; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_events ("idEvent", workout, category, game, title, description, status, "sumulaTemplate") FROM stdin;
\.


--
-- Data for Name: games_heat_slots; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_heat_slots (id, "heatId", "laneNumber", "teamCode", "gameCode") FROM stdin;
\.


--
-- Data for Name: games_heats; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_heats (id, "gameCode", "categoryId", "workoutCode", "heatNumber", "startTime", status) FROM stdin;
\.


--
-- Data for Name: games_register_athletes; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_register_athletes (code, name, cpf, "check", team, game, category, phonenumber, "birthDate", gender, "tshirtSize") FROM stdin;
1	CARLOS	\N	f	6340	SUMMER2026	6		1990-01-01 00:00:00	M	GG
2	SSSSS	\N	f	6340	SUMMER2026	6		1990-01-01 00:00:00	F	G
\.


--
-- Data for Name: games_scores; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_scores (code, "idEvent", game, category, "codeTeam", "time", weight, reps, judge, "dateScore", "dateCheck", status, photo, "numberTeam", point, rank, "isWO", "tieBreakTime", "penaltySeconds", "scoreStatus") FROM stdin;
\.


--
-- Data for Name: games_workout; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.games_workout (code, type, description, category, game, title, "timeCap", foto, status) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: itgames_user
--

COPY public.users (id, email, "passwordHash", name, cpf, "phoneNumber", role, "tenantOrgId", "createdAt", "updatedAt") FROM stdin;
6c589317-37d4-405f-ace0-d8a49c8064dc	organizador@crossfitgames.com.br	$2b$10$ET2s3BuARbv/4R6ee/O4m.M8qU3gpOqSQ5A93MHwtW09cNV5XR6fS	Carlos Organizador Head	11122233344	11988887777	ORGANIZER	org-crossfit-brazil	2026-10-02 02:29:08.338	2026-10-02 02:29:08.338
057e7753-f468-4155-949d-b9bd20c65f47	judge@itgames.com.br	$2b$10$ET2s3BuARbv/4R6ee/O4m.M8qU3gpOqSQ5A93MHwtW09cNV5XR6fS	Roberto Head Judge	22233344455	11977776666	JUDGE	\N	2026-10-02 02:29:08.342	2026-10-02 02:29:08.342
fd2a87c6-7970-428e-aa0a-19c7ec87947a	atleta@itgames.com.br	$2b$10$ET2s3BuARbv/4R6ee/O4m.M8qU3gpOqSQ5A93MHwtW09cNV5XR6fS	Lucas Crossfitter	33344455566	11966665555	ATHLETE	\N	2026-10-02 02:29:08.347	2026-10-02 02:29:08.347
0d5ac19f-36f7-4283-a6fb-34eae98c819f	thiago.atleta@itgames.com.br	$2b$10$67EvkbB9DKGoZ3xNO4ihweOO7oEzLEF4eW0X6S.1xBlQvow4Ii/UG	Thiago Atleta Teste	12345678901	11987654321	ATHLETE	\N	2026-10-05 22:30:53.81	2026-10-05 22:30:53.81
2b42b3e7-3b23-4d23-90ec-a03f95656f60	juliana.eventos@itgames.com.br	$2b$10$M6it907O1w2FcK3.sEmZT.vdDtyyqBBKgaEcqb63CpW8TzRke6eOu	Juliana Produtora	98765432100	11988889999	ORGANIZER	org-juliana.eventos	2026-10-05 22:30:58.497	2026-10-05 22:30:58.497
ea2009f4-b5a7-44be-94c6-95aa5a519ae5	carlosvazadv1985@gmail.com	$2b$10$LugBMBIPQc01zRoOkrIZ9.QU4tqsUIeJpz8xYEZT/we9ttlc78O.2	CARLOS ALBERTO DA SILVA VAZ	00458030139	62 99230-0507	ATHLETE	\N	2026-10-05 23:05:23.281	2026-10-05 23:05:23.281
5a31271a-3cf3-4ffe-97c5-3c0226cb8630	leonardo.alves@itmizer.com.br	$2b$10$AUpYnhHRcndK96L3zydLUuwHCKLbCZ299f7yr/Ab6bLoYKNdc0zo.	Leonardo Alves (Super Admin)	00000000000	11999999999	SUPER_ADMIN	\N	2026-10-05 23:15:47.143	2026-10-05 23:15:47.143
c8171ad1-1ea1-4672-84b3-b7540afbf924	phg.ajls@gmail.com	$2b$10$49HFyKD.8CGhwZhDB0fiK.zMUNVEXLZjCryiZxYlI6QedQYcuE.vu	Pedro Henriquer	\N	62992279009	ORGANIZER	Summer Cross 	2026-10-05 22:29:57.224	2026-10-05 23:15:47.146
\.


--
-- Name: games_scores_code_seq; Type: SEQUENCE SET; Schema: public; Owner: itgames_user
--

SELECT pg_catalog.setval('public.games_scores_code_seq', 2, true);


--
-- Name: GamesRegister GamesRegister_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public."GamesRegister"
    ADD CONSTRAINT "GamesRegister_pkey" PRIMARY KEY (code, "gameCode");


--
-- Name: athlete_profiles athlete_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.athlete_profiles
    ADD CONSTRAINT athlete_profiles_pkey PRIMARY KEY (id);


--
-- Name: games_audit_logs games_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_audit_logs
    ADD CONSTRAINT games_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: games_category games_category_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_category
    ADD CONSTRAINT games_category_pkey PRIMARY KEY (code, "gamesId");


--
-- Name: games_events games_events_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_events
    ADD CONSTRAINT games_events_pkey PRIMARY KEY ("idEvent", game);


--
-- Name: games_heat_slots games_heat_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heat_slots
    ADD CONSTRAINT games_heat_slots_pkey PRIMARY KEY (id);


--
-- Name: games_heats games_heats_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heats
    ADD CONSTRAINT games_heats_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (code);


--
-- Name: games_register_athletes games_register_athletes_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_register_athletes
    ADD CONSTRAINT games_register_athletes_pkey PRIMARY KEY (code, team);


--
-- Name: games_scores games_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_scores
    ADD CONSTRAINT games_scores_pkey PRIMARY KEY (code);


--
-- Name: games_workout games_workout_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_workout
    ADD CONSTRAINT games_workout_pkey PRIMARY KEY (code, game);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: athlete_profiles_userId_key; Type: INDEX; Schema: public; Owner: itgames_user
--

CREATE UNIQUE INDEX "athlete_profiles_userId_key" ON public.athlete_profiles USING btree ("userId");


--
-- Name: games_scores_codeTeam_idEvent_game_key; Type: INDEX; Schema: public; Owner: itgames_user
--

CREATE UNIQUE INDEX "games_scores_codeTeam_idEvent_game_key" ON public.games_scores USING btree ("codeTeam", "idEvent", game);


--
-- Name: users_cpf_key; Type: INDEX; Schema: public; Owner: itgames_user
--

CREATE UNIQUE INDEX users_cpf_key ON public.users USING btree (cpf);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: itgames_user
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: GamesRegister GamesRegister_categoryId_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public."GamesRegister"
    ADD CONSTRAINT "GamesRegister_categoryId_gameCode_fkey" FOREIGN KEY ("categoryId", "gameCode") REFERENCES public.games_category(code, "gamesId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GamesRegister GamesRegister_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public."GamesRegister"
    ADD CONSTRAINT "GamesRegister_gameCode_fkey" FOREIGN KEY ("gameCode") REFERENCES public.games(code) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: athlete_profiles athlete_profiles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.athlete_profiles
    ADD CONSTRAINT "athlete_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_audit_logs games_audit_logs_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_audit_logs
    ADD CONSTRAINT "games_audit_logs_gameCode_fkey" FOREIGN KEY ("gameCode") REFERENCES public.games(code) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_audit_logs games_audit_logs_scoreId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_audit_logs
    ADD CONSTRAINT "games_audit_logs_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES public.games_scores(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: games_category games_category_gamesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_category
    ADD CONSTRAINT "games_category_gamesId_fkey" FOREIGN KEY ("gamesId") REFERENCES public.games(code) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_events games_events_category_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_events
    ADD CONSTRAINT games_events_category_game_fkey FOREIGN KEY (category, game) REFERENCES public.games_category(code, "gamesId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_heat_slots games_heat_slots_heatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heat_slots
    ADD CONSTRAINT "games_heat_slots_heatId_fkey" FOREIGN KEY ("heatId") REFERENCES public.games_heats(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_heat_slots games_heat_slots_teamCode_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heat_slots
    ADD CONSTRAINT "games_heat_slots_teamCode_gameCode_fkey" FOREIGN KEY ("teamCode", "gameCode") REFERENCES public."GamesRegister"(code, "gameCode") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_heats games_heats_categoryId_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heats
    ADD CONSTRAINT "games_heats_categoryId_gameCode_fkey" FOREIGN KEY ("categoryId", "gameCode") REFERENCES public.games_category(code, "gamesId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_heats games_heats_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heats
    ADD CONSTRAINT "games_heats_gameCode_fkey" FOREIGN KEY ("gameCode") REFERENCES public.games(code) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_heats games_heats_workoutCode_gameCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_heats
    ADD CONSTRAINT "games_heats_workoutCode_gameCode_fkey" FOREIGN KEY ("workoutCode", "gameCode") REFERENCES public.games_workout(code, game) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games games_organizerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT "games_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: games_register_athletes games_register_athletes_team_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_register_athletes
    ADD CONSTRAINT games_register_athletes_team_game_fkey FOREIGN KEY (team, game) REFERENCES public."GamesRegister"(code, "gameCode") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_scores games_scores_codeTeam_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_scores
    ADD CONSTRAINT "games_scores_codeTeam_game_fkey" FOREIGN KEY ("codeTeam", game) REFERENCES public."GamesRegister"(code, "gameCode") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_scores games_scores_idEvent_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_scores
    ADD CONSTRAINT "games_scores_idEvent_game_fkey" FOREIGN KEY ("idEvent", game) REFERENCES public.games_events("idEvent", game) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games_workout games_workout_category_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itgames_user
--

ALTER TABLE ONLY public.games_workout
    ADD CONSTRAINT games_workout_category_game_fkey FOREIGN KEY (category, game) REFERENCES public.games_category(code, "gamesId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CdFufPWZ0fP5d4rHgnttDUxa59fJAa8E0K1Tykuh1rciw06QdIfBaDnd70Ag2tx

