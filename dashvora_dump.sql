--
-- PostgreSQL database dump
--

\restrict hBut4IYNeAqI7Wbh6o0fT2lSIAs3Y3O3VIUL1c0GBihDheOGvzLbwAt9JchSVOn

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
-- Name: netflix_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.netflix_titles (
    show_id character varying(10) NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(500) NOT NULL,
    director text,
    cast_members text,
    country character varying(500),
    date_added date,
    release_year integer NOT NULL,
    rating character varying(20),
    duration character varying(50),
    listed_in character varying(500),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: user_connectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_connectors (
    id character varying(64) NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'PostgreSQL'::character varying NOT NULL,
    host character varying(255) NOT NULL,
    port character varying(10) DEFAULT '5432'::character varying NOT NULL,
    database_name character varying(255) NOT NULL,
    username character varying(255) DEFAULT ''::character varying NOT NULL,
    password_encrypted text,
    ssl boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_uploaded_datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_uploaded_datasets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    table_name character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    columns jsonb NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_uploaded_datasets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_uploaded_datasets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_uploaded_datasets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_uploaded_datasets_id_seq OWNED BY public.user_uploaded_datasets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ai_api_key text,
    ai_provider text DEFAULT 'openai'::text,
    ai_model text DEFAULT 'gpt-4o'::text,
    ai_api_endpoint text DEFAULT ''::text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: user_uploaded_datasets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_uploaded_datasets ALTER COLUMN id SET DEFAULT nextval('public.user_uploaded_datasets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: netflix_titles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.netflix_titles (show_id, type, title, director, cast_members, country, date_added, release_year, rating, duration, listed_in, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
1	1	4a6b3c2603ff0c8445021a26eac4dfc9d3643b566ba7bb10c14ed412c58a4b1f	2026-05-31 17:50:47.871+05:30	t	2026-05-31 16:50:47.911182+05:30
\.


--
-- Data for Name: user_connectors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_connectors (id, user_id, name, type, host, port, database_name, username, password_encrypted, ssl, created_at, updated_at) FROM stdin;
saved_1781276840069_55uhube	1	Local Data	PostgreSQL	localhost	5432	dashvora	postgres	3b2dcd6322926ab6f94d5c46a413eaf9.71c2b43f4081d64054c69e1f3b68caa4.a71e3f18	f	2026-06-12 20:37:20.08507	2026-06-12 20:37:20.08507
\.


--
-- Data for Name: user_uploaded_datasets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_uploaded_datasets (id, user_id, table_name, original_filename, display_name, columns, row_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, created_at, updated_at, ai_api_key, ai_provider, ai_model, ai_api_endpoint) FROM stdin;
1	Abhay Kevat	abhaykumark@alohatechnologydev.com	$2b$12$BrwwjhfKjwwLCgcyOklwJOtzBxwqVNXQ2DHj2aP11MuXI6X5FZPOS	2026-05-31 15:13:10.221444+05:30	2026-05-31 18:30:09.277641+05:30	3c2ce13117f3fe3f75b04cc3e9e464ad.f030c68df6c451a3ab3b7c40a2fe0892.4f13dfbea5e8baf6f6704170e54963c0b780f780f3adc561562025897b4d42a01b942634a548df226a8d43866e0fcb4a28de38dd3feaaf73	openai	llama-3.3-70b-versatile	https://api.groq.com/openai/v1 
2	Test User	testuser@test.com	$2b$10$Mjk3kkl2YQqd7me0EF1e4.PNh.O5BnGUY.wcSa/TOLfOO/DZ6/tHC	2026-05-31 23:31:40.974858+05:30	2026-05-31 23:31:40.974858+05:30	\N	openai	gpt-4o	
3	Deep Patel	abhaykevat6355@gmail.com	$2b$12$UhXsrOuoMgnBsEVefLzpM.ApJlJfdjdl2LbPNcGUknYOczl2ha59S	2026-06-01 21:45:05.454963+05:30	2026-06-01 21:45:05.454963+05:30	\N	openai	gpt-4o	
\.


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, true);


--
-- Name: user_uploaded_datasets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_uploaded_datasets_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: netflix_titles netflix_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.netflix_titles
    ADD CONSTRAINT netflix_titles_pkey PRIMARY KEY (show_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: user_connectors user_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connectors
    ADD CONSTRAINT user_connectors_pkey PRIMARY KEY (id);


--
-- Name: user_uploaded_datasets user_uploaded_datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_uploaded_datasets
    ADD CONSTRAINT user_uploaded_datasets_pkey PRIMARY KEY (id);


--
-- Name: user_uploaded_datasets user_uploaded_datasets_user_id_table_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_uploaded_datasets
    ADD CONSTRAINT user_uploaded_datasets_user_id_table_name_key UNIQUE (user_id, table_name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_user_connectors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_connectors_user_id ON public.user_connectors USING btree (user_id);


--
-- Name: idx_user_uploaded_datasets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_uploaded_datasets_user_id ON public.user_uploaded_datasets USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_connectors user_connectors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_connectors
    ADD CONSTRAINT user_connectors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_uploaded_datasets user_uploaded_datasets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_uploaded_datasets
    ADD CONSTRAINT user_uploaded_datasets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hBut4IYNeAqI7Wbh6o0fT2lSIAs3Y3O3VIUL1c0GBihDheOGvzLbwAt9JchSVOn

