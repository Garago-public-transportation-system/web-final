--
-- PostgreSQL database dump
--

\restrict My3ltfI3RCBAdIU3fXYa3SaZ9cO3PARy2S9cgskOOac8sVbsBtsezNjQtEwDOD3

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.1 (Postgres.app)

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: driver_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.driver_status AS ENUM (
    'ACTIVE',
    'ON_TRIP',
    'ON_BREAK',
    'OFF_DUTY'
);


ALTER TYPE public.driver_status OWNER TO postgres;

--
-- Name: maintenance_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.maintenance_status AS ENUM (
    'PENDING',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'REJECTED'
);


ALTER TYPE public.maintenance_status OWNER TO postgres;

--
-- Name: maintenance_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.maintenance_type AS ENUM (
    'REGULAR',
    'EMERGENCY'
);


ALTER TYPE public.maintenance_type OWNER TO postgres;

--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_status AS ENUM (
    'PENDING',
    'DELIVERED',
    'READ'
);


ALTER TYPE public.notification_status OWNER TO postgres;

--
-- Name: replacement_reason; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.replacement_reason AS ENUM (
    'BREAK',
    'EMERGENCY_CROWDING',
    'EMERGENCY_BREAKDOWN',
    'NO_SHOW'
);


ALTER TYPE public.replacement_reason OWNER TO postgres;

--
-- Name: reroute_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reroute_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.reroute_status OWNER TO postgres;

--
-- Name: rotation_position; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rotation_position AS ENUM (
    'DRIVER_1',
    'DRIVER_2',
    'DRIVER_3'
);


ALTER TYPE public.rotation_position OWNER TO postgres;

--
-- Name: shift_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_type AS ENUM (
    'MORNING',
    'EVENING'
);


ALTER TYPE public.shift_type OWNER TO postgres;

--
-- Name: trip_direction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.trip_direction AS ENUM (
    'OUTBOUND',
    'INBOUND'
);


ALTER TYPE public.trip_direction OWNER TO postgres;

--
-- Name: trip_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.trip_status AS ENUM (
    'SCHEDULED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public.trip_status OWNER TO postgres;

--
-- Name: tripticksetstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tripticksetstatus AS ENUM (
    'ISSUED',
    'USED',
    'CANCELLED',
    'EXPIRED'
);


ALTER TYPE public.tripticksetstatus OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'MANAGER',
    'DRIVER'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.vehicle_status AS ENUM (
    'FREE',
    'ASSIGNED',
    'EN_ROUTE',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);


ALTER TYPE public.vehicle_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(128) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id integer,
    old_values json,
    new_values json,
    ip_address character varying(50),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: break_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.break_logs (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    shift_date date NOT NULL,
    break_number integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration_minutes double precision,
    replaced_by_driver_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.break_logs OWNER TO postgres;

--
-- Name: break_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.break_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.break_logs_id_seq OWNER TO postgres;

--
-- Name: break_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.break_logs_id_seq OWNED BY public.break_logs.id;


--
-- Name: camera_readings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.camera_readings (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    passenger_count integer NOT NULL,
    crowding_score double precision NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.camera_readings OWNER TO postgres;

--
-- Name: camera_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.camera_readings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.camera_readings_id_seq OWNER TO postgres;

--
-- Name: camera_readings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.camera_readings_id_seq OWNED BY public.camera_readings.id;


--
-- Name: crowding_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crowding_events (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    crowding_score double precision NOT NULL,
    passenger_count integer NOT NULL,
    auto_dispatch_triggered boolean NOT NULL,
    recorded_at timestamp with time zone NOT NULL
);


ALTER TABLE public.crowding_events OWNER TO postgres;

--
-- Name: crowding_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crowding_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crowding_events_id_seq OWNER TO postgres;

--
-- Name: crowding_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crowding_events_id_seq OWNED BY public.crowding_events.id;


--
-- Name: daily_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_reports (
    id integer NOT NULL,
    report_date date NOT NULL,
    total_trips integer NOT NULL,
    completed_trips integer NOT NULL,
    cancelled_trips integer NOT NULL,
    total_revenue double precision NOT NULL,
    total_passengers integer NOT NULL,
    avg_crowding_score double precision NOT NULL,
    on_time_percentage double precision NOT NULL,
    total_maintenance_requests integer NOT NULL,
    active_vehicles integer NOT NULL,
    active_drivers integer NOT NULL,
    extra_dispatches integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.daily_reports OWNER TO postgres;

--
-- Name: daily_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_reports_id_seq OWNER TO postgres;

--
-- Name: daily_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_reports_id_seq OWNED BY public.daily_reports.id;


--
-- Name: driver_exchanges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_exchanges (
    id integer NOT NULL,
    rotation_assignment_id integer NOT NULL,
    outgoing_driver_id integer NOT NULL,
    incoming_driver_id integer NOT NULL,
    reason public.replacement_reason NOT NULL,
    exchange_time timestamp with time zone NOT NULL,
    return_time timestamp with time zone,
    trip_id integer,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.driver_exchanges OWNER TO postgres;

--
-- Name: driver_exchanges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.driver_exchanges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driver_exchanges_id_seq OWNER TO postgres;

--
-- Name: driver_exchanges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.driver_exchanges_id_seq OWNED BY public.driver_exchanges.id;


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    license_number character varying(50) NOT NULL,
    license_expiry date,
    garage_id integer,
    status public.driver_status NOT NULL,
    current_vehicle_id integer,
    current_route_id integer,
    total_trips_today integer NOT NULL,
    total_trips_all_time integer NOT NULL,
    rating double precision NOT NULL,
    break_time_remaining double precision NOT NULL,
    total_break_time_today double precision NOT NULL,
    break_start_time timestamp with time zone,
    trips_since_last_break integer NOT NULL,
    current_break_number integer NOT NULL,
    min_break_duration double precision NOT NULL,
    max_break_duration double precision NOT NULL,
    current_shift public.shift_type,
    shift_start_time timestamp with time zone,
    shift_end_time timestamp with time zone,
    fatigue_score double precision NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.drivers OWNER TO postgres;

--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drivers_id_seq OWNER TO postgres;

--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: garages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.garages (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    address character varying(500),
    latitude double precision,
    longitude double precision,
    total_capacity integer NOT NULL,
    current_occupancy integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.garages OWNER TO postgres;

--
-- Name: garages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.garages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.garages_id_seq OWNER TO postgres;

--
-- Name: garages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.garages_id_seq OWNED BY public.garages.id;


--
-- Name: gate_cameras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gate_cameras (
    id integer NOT NULL,
    location_name character varying(255) NOT NULL,
    ip_address character varying(50) NOT NULL,
    gate_type character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.gate_cameras OWNER TO postgres;

--
-- Name: gate_cameras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gate_cameras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gate_cameras_id_seq OWNER TO postgres;

--
-- Name: gate_cameras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gate_cameras_id_seq OWNED BY public.gate_cameras.id;


--
-- Name: gate_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gate_logs (
    id integer NOT NULL,
    gate_id character varying(50) NOT NULL,
    plate_number character varying(50) NOT NULL,
    confidence double precision NOT NULL,
    event character varying(50) NOT NULL,
    vehicle_id integer,
    created_at timestamp with time zone NOT NULL,
    ocr_raw_text character varying(100),
    match_method character varying(50)
);


ALTER TABLE public.gate_logs OWNER TO postgres;

--
-- Name: gate_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gate_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gate_logs_id_seq OWNER TO postgres;

--
-- Name: gate_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gate_logs_id_seq OWNED BY public.gate_logs.id;


--
-- Name: gps_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gps_tracking (
    id integer NOT NULL,
    vehicle_id integer NOT NULL,
    trip_id integer,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    speed double precision NOT NULL,
    heading double precision NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.gps_tracking OWNER TO postgres;

--
-- Name: gps_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gps_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gps_tracking_id_seq OWNER TO postgres;

--
-- Name: gps_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gps_tracking_id_seq OWNED BY public.gps_tracking.id;


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_requests (
    id integer NOT NULL,
    vehicle_id integer NOT NULL,
    requested_by_id integer NOT NULL,
    approved_by_id integer,
    type public.maintenance_type NOT NULL,
    status public.maintenance_status NOT NULL,
    priority integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    estimated_cost double precision,
    actual_cost double precision,
    scheduled_date date,
    completed_date date,
    rejection_reason text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.maintenance_requests OWNER TO postgres;

--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maintenance_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_requests_id_seq OWNER TO postgres;

--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maintenance_requests_id_seq OWNED BY public.maintenance_requests.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) NOT NULL,
    status public.notification_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: reroute_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reroute_logs (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    trip_id integer,
    original_route_id integer,
    new_route_id integer,
    approved_by integer,
    status public.reroute_status NOT NULL,
    reason text,
    requested_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.reroute_logs OWNER TO postgres;

--
-- Name: reroute_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reroute_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reroute_logs_id_seq OWNER TO postgres;

--
-- Name: reroute_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reroute_logs_id_seq OWNED BY public.reroute_logs.id;


--
-- Name: rotation_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rotation_assignments (
    id integer NOT NULL,
    route_id integer NOT NULL,
    driver_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    shift_type public.shift_type NOT NULL,
    "position" public.rotation_position NOT NULL,
    shift_date date NOT NULL,
    shift_start_time timestamp with time zone NOT NULL,
    shift_end_time timestamp with time zone NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.rotation_assignments OWNER TO postgres;

--
-- Name: rotation_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rotation_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rotation_assignments_id_seq OWNER TO postgres;

--
-- Name: rotation_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rotation_assignments_id_seq OWNED BY public.rotation_assignments.id;


--
-- Name: route_stops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_stops (
    id integer NOT NULL,
    route_id integer NOT NULL,
    stop_name character varying(255) NOT NULL,
    sequence_order integer NOT NULL,
    latitude double precision,
    longitude double precision,
    dwell_time_minutes double precision NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.route_stops OWNER TO postgres;

--
-- Name: route_stops_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.route_stops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_stops_id_seq OWNER TO postgres;

--
-- Name: route_stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.route_stops_id_seq OWNED BY public.route_stops.id;


--
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    start_location character varying(255) NOT NULL,
    end_location character varying(255) NOT NULL,
    distance_km double precision,
    estimated_time_minutes double precision NOT NULL,
    fare double precision NOT NULL,
    turnaround_time_minutes double precision NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- Name: routes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.routes_id_seq OWNER TO postgres;

--
-- Name: routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.routes_id_seq OWNED BY public.routes.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    ticket_code character varying(8) NOT NULL,
    trip_id integer NOT NULL,
    passenger_name character varying(255),
    seat_number character varying(10),
    price double precision NOT NULL,
    status public.tripticksetstatus NOT NULL,
    purchase_time timestamp with time zone NOT NULL,
    validation_time timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: trips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trips (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    vehicle_id integer NOT NULL,
    route_id integer NOT NULL,
    rotation_assignment_id integer,
    direction public.trip_direction NOT NULL,
    status public.trip_status NOT NULL,
    trip_number character varying(50),
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    passenger_count integer NOT NULL,
    crowding_score double precision NOT NULL,
    is_crowded boolean NOT NULL,
    driver_crowding_report boolean NOT NULL,
    fare_collected double precision NOT NULL,
    is_extra_dispatch boolean NOT NULL,
    is_late boolean NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_trips_end_after_start CHECK (((scheduled_end IS NULL) OR (scheduled_end >= scheduled_start)))
);


ALTER TABLE public.trips OWNER TO postgres;

--
-- Name: trips_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trips_id_seq OWNER TO postgres;

--
-- Name: trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trips_id_seq OWNED BY public.trips.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    phone character varying(20),
    preferred_language character varying(5) NOT NULL,
    is_active boolean NOT NULL,
    is_email_verified boolean NOT NULL,
    email_verification_token character varying(128),
    password_reset_token character varying(128),
    password_reset_expires timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    plate_number character varying(20) NOT NULL,
    model character varying(100) NOT NULL,
    year integer,
    capacity integer NOT NULL,
    status public.vehicle_status NOT NULL,
    garage_id integer,
    current_latitude double precision,
    current_longitude double precision,
    mileage double precision NOT NULL,
    fuel_level double precision NOT NULL,
    last_maintenance_date date,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicles_id_seq OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: break_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.break_logs ALTER COLUMN id SET DEFAULT nextval('public.break_logs_id_seq'::regclass);


--
-- Name: camera_readings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_readings ALTER COLUMN id SET DEFAULT nextval('public.camera_readings_id_seq'::regclass);


--
-- Name: crowding_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crowding_events ALTER COLUMN id SET DEFAULT nextval('public.crowding_events_id_seq'::regclass);


--
-- Name: daily_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reports ALTER COLUMN id SET DEFAULT nextval('public.daily_reports_id_seq'::regclass);


--
-- Name: driver_exchanges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges ALTER COLUMN id SET DEFAULT nextval('public.driver_exchanges_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: garages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.garages ALTER COLUMN id SET DEFAULT nextval('public.garages_id_seq'::regclass);


--
-- Name: gate_cameras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_cameras ALTER COLUMN id SET DEFAULT nextval('public.gate_cameras_id_seq'::regclass);


--
-- Name: gate_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_logs ALTER COLUMN id SET DEFAULT nextval('public.gate_logs_id_seq'::regclass);


--
-- Name: gps_tracking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_tracking ALTER COLUMN id SET DEFAULT nextval('public.gps_tracking_id_seq'::regclass);


--
-- Name: maintenance_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_requests ALTER COLUMN id SET DEFAULT nextval('public.maintenance_requests_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: reroute_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs ALTER COLUMN id SET DEFAULT nextval('public.reroute_logs_id_seq'::regclass);


--
-- Name: rotation_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments ALTER COLUMN id SET DEFAULT nextval('public.rotation_assignments_id_seq'::regclass);


--
-- Name: route_stops id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_stops ALTER COLUMN id SET DEFAULT nextval('public.route_stops_id_seq'::regclass);


--
-- Name: routes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes ALTER COLUMN id SET DEFAULT nextval('public.routes_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: trips id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips ALTER COLUMN id SET DEFAULT nextval('public.trips_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
1e7de45c5093
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at, updated_at) FROM stdin;
1	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 04:14:20.680565+02	2026-04-18 04:14:20.680565+02
2	3	LOGIN	User	3	null	null	127.0.0.1	2026-04-18 04:20:16.673368+02	2026-04-18 04:20:16.673368+02
3	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 09:10:09.82494+02	2026-04-18 09:10:09.82494+02
4	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 09:53:05.98878+02	2026-04-18 09:53:05.98878+02
5	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 11:18:01.323434+02	2026-04-18 11:18:01.323434+02
6	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 11:18:30.486469+02	2026-04-18 11:18:30.486469+02
7	4	APPROVE	MaintenanceRequest	1	{"status": "PENDING"}	{"status": "APPROVED"}	\N	2026-04-18 11:18:41.489088+02	2026-04-18 11:18:41.489088+02
8	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 11:19:19.724113+02	2026-04-18 11:19:19.724113+02
9	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 11:39:16.468796+02	2026-04-18 11:39:16.468796+02
10	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 11:42:14.724103+02	2026-04-18 11:42:14.724103+02
11	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 11:45:08.088087+02	2026-04-18 11:45:08.088087+02
12	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 11:46:52.768632+02	2026-04-18 11:46:52.768632+02
13	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 11:47:32.070977+02	2026-04-18 11:47:32.070977+02
14	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 11:50:20.565341+02	2026-04-18 11:50:20.565341+02
15	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 11:52:19.700451+02	2026-04-18 11:52:19.700451+02
16	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 11:54:29.147282+02	2026-04-18 11:54:29.147282+02
17	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 12:01:56.618507+02	2026-04-18 12:01:56.618507+02
18	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 12:05:08.927351+02	2026-04-18 12:05:08.927351+02
19	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 12:27:27.323332+02	2026-04-18 12:27:27.323332+02
20	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 12:38:09.153474+02	2026-04-18 12:38:09.153474+02
21	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 12:40:08.355345+02	2026-04-18 12:40:08.355345+02
22	1	DEACTIVATE	Driver	13	null	null	\N	2026-04-18 12:48:40.920124+02	2026-04-18 12:48:40.920124+02
23	13	LOGIN	User	13	null	null	127.0.0.1	2026-04-18 12:49:06.67562+02	2026-04-18 12:49:06.67562+02
24	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 13:02:49.755877+02	2026-04-18 13:02:49.755877+02
25	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 13:05:55.599663+02	2026-04-18 13:05:55.599663+02
26	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 13:07:47.78886+02	2026-04-18 13:07:47.78886+02
27	11	LOGIN	User	11	null	null	127.0.0.1	2026-04-18 13:17:26.472972+02	2026-04-18 13:17:26.472972+02
28	4	LOGIN	User	4	null	null	127.0.0.1	2026-04-18 13:36:21.802957+02	2026-04-18 13:36:21.802957+02
29	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-18 13:41:08.294654+02	2026-04-18 13:41:08.294654+02
30	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-22 14:06:05.460616+02	2026-04-22 14:06:05.460616+02
31	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-22 14:06:14.084108+02	2026-04-22 14:06:14.084108+02
32	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-25 15:37:20.067152+03	2026-04-25 15:37:20.067152+03
33	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-25 15:39:08.512842+03	2026-04-25 15:39:08.512842+03
34	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-25 16:50:06.001657+03	2026-04-25 16:50:06.001657+03
35	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-29 00:19:10.363677+03	2026-04-29 00:19:10.363677+03
36	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-29 00:32:34.991414+03	2026-04-29 00:32:34.991414+03
37	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-29 00:33:43.815577+03	2026-04-29 00:33:43.815577+03
38	1	LOGIN	User	1	null	null	127.0.0.1	2026-04-29 00:48:01.823203+03	2026-04-29 00:48:01.823203+03
\.


--
-- Data for Name: break_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.break_logs (id, driver_id, shift_date, break_number, start_time, end_time, duration_minutes, replaced_by_driver_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: camera_readings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.camera_readings (id, trip_id, vehicle_id, passenger_count, crowding_score, created_at) FROM stdin;
\.


--
-- Data for Name: crowding_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crowding_events (id, trip_id, vehicle_id, crowding_score, passenger_count, auto_dispatch_triggered, recorded_at) FROM stdin;
\.


--
-- Data for Name: daily_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_reports (id, report_date, total_trips, completed_trips, cancelled_trips, total_revenue, total_passengers, avg_crowding_score, on_time_percentage, total_maintenance_requests, active_vehicles, active_drivers, extra_dispatches, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: driver_exchanges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.driver_exchanges (id, rotation_assignment_id, outgoing_driver_id, incoming_driver_id, reason, exchange_time, return_time, trip_id, notes, created_at, updated_at) FROM stdin;
1	25	1	3	BREAK	2026-04-18 09:03:40.343679+02	\N	\N	Rotation swap due to break schedule	2026-04-18 09:03:40.264222+02	2026-04-18 09:03:40.264222+02
2	31	7	9	BREAK	2026-04-18 09:03:40.347657+02	\N	\N	Rotation swap due to break schedule	2026-04-18 09:03:40.264222+02	2026-04-18 09:03:40.264222+02
3	37	13	15	BREAK	2026-04-18 09:03:40.349774+02	\N	\N	Rotation swap due to break schedule	2026-04-18 09:03:40.264222+02	2026-04-18 09:03:40.264222+02
4	43	19	21	BREAK	2026-04-18 09:03:40.351755+02	\N	\N	Rotation swap due to break schedule	2026-04-18 09:03:40.264222+02	2026-04-18 09:03:40.264222+02
5	26	2	1	BREAK	2026-04-18 11:07:37.354198+02	\N	\N	Rotation swap due to break schedule	2026-04-18 11:07:37.214579+02	2026-04-18 11:07:37.214579+02
6	32	8	7	BREAK	2026-04-18 11:07:37.357431+02	\N	\N	Rotation swap due to break schedule	2026-04-18 11:07:37.214579+02	2026-04-18 11:07:37.214579+02
7	38	14	13	BREAK	2026-04-18 11:07:37.377571+02	\N	\N	Rotation swap due to break schedule	2026-04-18 11:07:37.214579+02	2026-04-18 11:07:37.214579+02
8	44	20	19	BREAK	2026-04-18 11:07:37.446995+02	\N	\N	Rotation swap due to break schedule	2026-04-18 11:07:37.214579+02	2026-04-18 11:07:37.214579+02
9	27	3	2	BREAK	2026-04-18 13:04:57.518292+02	\N	\N	Rotation swap due to break schedule	2026-04-18 13:04:57.474105+02	2026-04-18 13:04:57.474105+02
10	33	9	8	BREAK	2026-04-18 13:04:57.531498+02	\N	\N	Rotation swap due to break schedule	2026-04-18 13:04:57.474105+02	2026-04-18 13:04:57.474105+02
11	39	15	14	BREAK	2026-04-18 13:04:57.538895+02	\N	\N	Rotation swap due to break schedule	2026-04-18 13:04:57.474105+02	2026-04-18 13:04:57.474105+02
12	45	21	20	BREAK	2026-04-18 13:04:57.543744+02	\N	\N	Rotation swap due to break schedule	2026-04-18 13:04:57.474105+02	2026-04-18 13:04:57.474105+02
13	28	4	6	BREAK	2026-04-18 18:02:40.775219+02	\N	\N	Rotation swap due to break schedule	2026-04-18 18:02:40.704308+02	2026-04-18 18:02:40.704308+02
14	34	10	12	BREAK	2026-04-18 18:02:40.779831+02	\N	\N	Rotation swap due to break schedule	2026-04-18 18:02:40.704308+02	2026-04-18 18:02:40.704308+02
15	40	16	18	BREAK	2026-04-18 18:02:40.817051+02	\N	\N	Rotation swap due to break schedule	2026-04-18 18:02:40.704308+02	2026-04-18 18:02:40.704308+02
16	46	22	24	BREAK	2026-04-18 18:02:40.819751+02	\N	\N	Rotation swap due to break schedule	2026-04-18 18:02:40.704308+02	2026-04-18 18:02:40.704308+02
17	29	5	4	BREAK	2026-04-18 20:10:52.582762+02	\N	\N	Rotation swap due to break schedule	2026-04-18 20:10:52.478239+02	2026-04-18 20:10:52.478239+02
18	35	11	10	BREAK	2026-04-18 20:10:52.589865+02	\N	\N	Rotation swap due to break schedule	2026-04-18 20:10:52.478239+02	2026-04-18 20:10:52.478239+02
19	41	17	16	BREAK	2026-04-18 20:10:52.627468+02	\N	\N	Rotation swap due to break schedule	2026-04-18 20:10:52.478239+02	2026-04-18 20:10:52.478239+02
20	47	23	22	BREAK	2026-04-18 20:10:52.630344+02	\N	\N	Rotation swap due to break schedule	2026-04-18 20:10:52.478239+02	2026-04-18 20:10:52.478239+02
21	36	12	11	BREAK	2026-04-18 22:00:32.648294+02	\N	\N	Rotation swap due to break schedule	2026-04-18 22:00:32.442284+02	2026-04-18 22:00:32.442284+02
22	42	18	17	BREAK	2026-04-18 22:00:32.656382+02	\N	\N	Rotation swap due to break schedule	2026-04-18 22:00:32.442284+02	2026-04-18 22:00:32.442284+02
23	48	24	23	BREAK	2026-04-18 22:00:32.657815+02	\N	\N	Rotation swap due to break schedule	2026-04-18 22:00:32.442284+02	2026-04-18 22:00:32.442284+02
24	30	6	5	BREAK	2026-04-18 22:00:32.659297+02	\N	\N	Rotation swap due to break schedule	2026-04-18 22:00:32.442284+02	2026-04-18 22:00:32.442284+02
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drivers (id, user_id, license_number, license_expiry, garage_id, status, current_vehicle_id, current_route_id, total_trips_today, total_trips_all_time, rating, break_time_remaining, total_break_time_today, break_start_time, trips_since_last_break, current_break_number, min_break_duration, max_break_duration, current_shift, shift_start_time, shift_end_time, fatigue_score, created_at, updated_at) FROM stdin;
25	30	LIC-1025	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
26	31	LIC-1026	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
27	32	LIC-1027	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
28	33	LIC-1028	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
29	34	LIC-1029	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
30	35	LIC-1030	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	\N	\N	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
1	6	LIC-1001	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 11:07:37.354174+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 11:07:37.214579+02
7	12	LIC-1007	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 11:07:37.357425+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 11:07:37.214579+02
19	24	LIC-1019	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 11:07:37.446981+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 11:07:37.214579+02
13	18	LIC-1013	2027-04-17	1	OFF_DUTY	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 11:07:37.377562+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 12:48:40.920124+02
2	7	LIC-1002	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 13:04:57.518277+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
3	8	LIC-1003	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 09:03:40.343634+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
8	13	LIC-1008	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 13:04:57.531489+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
9	14	LIC-1009	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 09:03:40.347651+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
14	19	LIC-1014	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 13:04:57.538885+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
15	20	LIC-1015	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 09:03:40.349767+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
20	25	LIC-1020	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 13:04:57.543729+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
21	26	LIC-1021	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 09:03:40.351748+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 13:04:57.474105+02
4	9	LIC-1004	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 20:10:52.582726+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 20:10:52.478239+02
10	15	LIC-1010	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 20:10:52.589855+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 20:10:52.478239+02
16	21	LIC-1016	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 20:10:52.62746+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 20:10:52.478239+02
22	27	LIC-1022	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 20:10:52.63034+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 20:10:52.478239+02
5	10	LIC-1005	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 22:00:32.65929+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
11	16	LIC-1011	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 22:00:32.64666+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
12	17	LIC-1012	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 18:02:40.779824+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
17	22	LIC-1017	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 22:00:32.656372+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
18	23	LIC-1018	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 18:02:40.817043+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
23	28	LIC-1023	2027-04-17	1	ACTIVE	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 22:00:32.657808+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
24	29	LIC-1024	2027-04-17	1	ON_BREAK	\N	\N	0	0	5	60	0	\N	0	0	10	30	\N	2026-04-18 18:02:40.819746+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-18 22:00:32.442284+02
6	11	LIC-1006	2027-04-17	1	ON_BREAK	\N	\N	0	2	5	60	0	\N	0	0	10	30	\N	2026-04-18 11:54:14.479764+02	\N	0	2026-04-17 23:04:57.902634+02	2026-04-23 00:00:00.314984+02
\.


--
-- Data for Name: garages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.garages (id, name, address, latitude, longitude, total_capacity, current_occupancy, created_at, updated_at) FROM stdin;
1	Cairo Central Garage	123 Ramses St, Cairo	30.0636	31.2474	100	0	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
\.


--
-- Data for Name: gate_cameras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gate_cameras (id, location_name, ip_address, gate_type, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: gate_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gate_logs (id, gate_id, plate_number, confidence, event, vehicle_id, created_at, ocr_raw_text, match_method) FROM stdin;
1	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:20:09.265646+03	\N	\N
2	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:20:11.531375+03	\N	\N
3	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:28.910393+03	\N	\N
4	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:32.956385+03	\N	\N
5	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:36.264956+03	\N	\N
6	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:38.97591+03	\N	\N
7	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:41.396288+03	\N	\N
8	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:43.731297+03	\N	\N
9	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:21:46.736173+03	\N	\N
10	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:22:17.236774+03	\N	\N
11	1	5	0.9972970893334185	DENIED	\N	2026-04-24 20:22:25.839811+03	\N	\N
12	1	5	0.999875906979586	DENIED	\N	2026-04-24 20:22:29.315088+03	\N	\N
13	1	UNREADABLE	0	IGNORED	\N	2026-04-24 20:25:05.329751+03	\N	\N
14	1	5	0.9998778142107803	DENIED	\N	2026-04-24 20:25:09.47339+03	\N	\N
15	1	5	0.9999787808590241	DENIED	\N	2026-04-24 20:25:25.847481+03	\N	\N
16	1	5	0.9999938011265499	DENIED	\N	2026-04-24 20:26:56.923589+03	\N	\N
17	1	ABC101	0.8343187326427068	IGNORED	\N	2026-04-24 20:27:03.029301+03	\N	\N
18	1	ABC101	0.9972986076450322	DENIED	\N	2026-04-24 20:27:06.083122+03	\N	\N
19	1	ABC101	0.8147821323678432	IGNORED	\N	2026-04-24 20:27:15.700896+03	\N	\N
20	1		0	IGNORED	\N	2026-04-25 02:34:43.053819+03		none
21	1		0	IGNORED	\N	2026-04-25 02:34:53.209616+03		none
22	1		0	IGNORED	\N	2026-04-25 02:34:56.006462+03		none
23	1		0	IGNORED	\N	2026-04-25 02:34:58.654929+03		none
24	1	ABC101	0.998360982735984	DENIED	\N	2026-04-25 02:35:22.821683+03	ABC-101	none
25	1		0	IGNORED	\N	2026-04-25 02:35:52.977712+03		none
26	1	ABC101	0.9995770672795432	DENIED	\N	2026-04-25 02:35:54.758446+03	ABC-101	none
27	1	ABC101	0.9992748598440666	DENIED	\N	2026-04-25 02:35:56.692596+03	ABC-101	none
28	1	ABC101	0.9990236437900224	DENIED	\N	2026-04-25 02:35:59.914684+03	ABC-101	none
29	1	ABC101	0.9999375054820532	DENIED	\N	2026-04-25 02:36:21.337938+03	ABC-101	none
30	1		0	IGNORED	\N	2026-04-25 02:40:39.27697+03		none
31	1		0	IGNORED	\N	2026-04-25 02:40:43.309178+03		none
32	1		0	IGNORED	\N	2026-04-25 02:41:05.198491+03		none
33	1	HI	0.9999713402633025	DENIED	\N	2026-04-25 02:41:54.33521+03	Hi	none
34	1	HI	0.9999497613262032	DENIED	\N	2026-04-25 02:47:03.553051+03	Hi	none
35	1	HI	0.9999822983695145	DENIED	\N	2026-04-25 02:47:06.140308+03	Hi	none
36	1	HI	0.9999650182949482	GRANTED	2	2026-04-25 02:47:40.066726+03	Hi	exact
37	1	ABC101	0.9997880452009562	DENIED	\N	2026-04-25 02:48:26.316367+03	ABC-101	none
38	1	ABC101	0.976297613686384	DENIED	\N	2026-04-25 02:48:47.78577+03	ABC-101	none
39	1	ABC101	0.9593731680102648	DENIED	\N	2026-04-25 02:50:11.879248+03	ABC 101	none
40	1		0	IGNORED	\N	2026-04-25 02:50:45.056117+03		none
41	1	ABC101	0.9102068684378426	GRANTED	2	2026-04-25 02:50:47.037856+03	ABC 101	exact
42	1	ABC101	0.9927327500521926	GRANTED	2	2026-04-25 02:51:52.678119+03	ABC 101	exact
43	1		0	IGNORED	\N	2026-04-25 02:52:14.443579+03		none
44	1		0	IGNORED	\N	2026-04-25 02:52:16.677515+03		none
45	1		0	IGNORED	\N	2026-04-25 02:52:23.262522+03		none
46	1		0	IGNORED	\N	2026-04-25 02:52:24.9444+03		none
47	1	101	0.9999088067491786	DENIED	\N	2026-04-25 02:52:26.804968+03	101	none
48	1	101	0.9999996558724309	DENIED	\N	2026-04-25 02:52:30.277529+03	101	none
49	1		0	IGNORED	\N	2026-04-25 02:52:41.847776+03		none
50	1	101	0.9999973158053815	DENIED	\N	2026-04-25 02:52:51.517293+03	101	none
51	1	101	0.9999972469798912	DENIED	\N	2026-04-25 02:52:53.579664+03	101	none
52	1	101	1	DENIED	\N	2026-04-25 02:52:55.313543+03	101	none
53	1	ABC	0.9999800406272169	DENIED	\N	2026-04-25 02:52:57.394524+03	ABC	none
54	1	AS611	0.10172222660658994	IGNORED	\N	2026-04-25 02:54:21.544393+03	AS61( 1	none
55	1	ABC101	0.9936375974181998	GRANTED	2	2026-04-25 02:54:24.132331+03	ABC101	exact
\.


--
-- Data for Name: gps_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gps_tracking (id, vehicle_id, trip_id, latitude, longitude, speed, heading, recorded_at, created_at) FROM stdin;
\.


--
-- Data for Name: maintenance_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_requests (id, vehicle_id, requested_by_id, approved_by_id, type, status, priority, title, description, estimated_cost, actual_cost, scheduled_date, completed_date, rejection_reason, created_at, updated_at) FROM stdin;
2	2	7	3	REGULAR	APPROVED	3	Oil Change	Scheduled 10,000 km oil change	\N	\N	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
3	3	8	4	REGULAR	COMPLETED	2	Tire Replacement	Front left tire worn below 3mm	\N	850	\N	2026-04-17	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
1	1	6	4	EMERGENCY	APPROVED	1	Engine Smoke	Smoke coming from engine bay during morning shift	\N	\N	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-18 11:18:41.489088+02
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, notification_type, status, created_at, updated_at) FROM stdin;
1	6	Maintenance Approved	Your request 'Engine Smoke' has been approved.	MAINTENANCE	PENDING	2026-04-18 11:18:41.489088+02	2026-04-18 11:18:41.489088+02
2	11	Reroute request approved	Your reroute request has been approved.	reroute_decision	PENDING	2026-04-18 11:47:49.009454+02	2026-04-18 11:47:49.009454+02
3	11	Reroute request approved	Your reroute request has been approved.	reroute_decision	PENDING	2026-04-18 12:02:15.61137+02	2026-04-18 12:02:15.61137+02
4	11	Reroute request approved	Your reroute request has been approved.	reroute_decision	PENDING	2026-04-18 12:02:17.851643+02	2026-04-18 12:02:17.851643+02
5	11	Reroute request approved	Your reroute request has been approved.	reroute_decision	PENDING	2026-04-18 12:02:19.152837+02	2026-04-18 12:02:19.152837+02
6	1	Schedule generation: 6 route(s) unstaffed	Ramses - Maadi — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Maadi — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Giza — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles) (+1 more)	SCHEDULE_GAP	PENDING	2026-04-29 00:36:28.11191+03	2026-04-29 00:36:28.11191+03
7	2	Schedule generation: 6 route(s) unstaffed	Ramses - Maadi — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Maadi — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Giza — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles) (+1 more)	SCHEDULE_GAP	PENDING	2026-04-29 00:36:28.11191+03	2026-04-29 00:36:28.11191+03
8	1	Schedule generation: 6 route(s) unstaffed	Ramses - Maadi — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Maadi — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Giza — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles) (+1 more)	SCHEDULE_GAP	PENDING	2026-04-29 00:36:31.595218+03	2026-04-29 00:36:31.595218+03
9	2	Schedule generation: 6 route(s) unstaffed	Ramses - Maadi — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Maadi — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - 5th Settlement — insufficient pool for EVENING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles); Ramses - Giza — insufficient pool for MORNING (drivers_left=1, vehicles_left=13; need 3 drivers + 2 vehicles) (+1 more)	SCHEDULE_GAP	PENDING	2026-04-29 00:36:31.595218+03	2026-04-29 00:36:31.595218+03
\.


--
-- Data for Name: reroute_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reroute_logs (id, driver_id, trip_id, original_route_id, new_route_id, approved_by, status, reason, requested_at, created_at, updated_at) FROM stdin;
2	6	\N	\N	1	4	APPROVED	Accident on Sues Road	2026-04-18 11:46:05.113992+02	2026-04-18 11:46:05.113992+02	2026-04-18 11:47:49.009454+02
5	6	59	1	2	4	APPROVED	Accident on Suez Road	2026-04-18 12:01:30.544266+02	2026-04-18 12:01:30.544266+02	2026-04-18 12:02:15.61137+02
3	6	\N	\N	\N	4	APPROVED	Accident on Sues Road	2026-04-18 11:51:48.081879+02	2026-04-18 11:51:48.081879+02	2026-04-18 12:02:17.851643+02
4	6	\N	\N	\N	4	APPROVED	Accident on Sues Road	2026-04-18 11:51:54.14574+02	2026-04-18 11:51:54.14574+02	2026-04-18 12:02:19.152837+02
\.


--
-- Data for Name: rotation_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rotation_assignments (id, route_id, driver_id, vehicle_id, shift_type, "position", shift_date, shift_start_time, shift_end_time, is_active, created_at, updated_at) FROM stdin;
28	1	4	3	EVENING	DRIVER_1	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 20:10:52.478239+02
25	1	1	1	MORNING	DRIVER_1	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 11:07:37.214579+02
34	2	10	7	EVENING	DRIVER_1	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 20:10:52.478239+02
31	2	7	5	MORNING	DRIVER_1	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 11:07:37.214579+02
37	3	13	9	MORNING	DRIVER_1	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 11:07:37.214579+02
40	3	16	11	EVENING	DRIVER_1	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 20:10:52.478239+02
43	4	19	13	MORNING	DRIVER_1	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 11:07:37.214579+02
26	1	2	1	MORNING	DRIVER_2	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
27	1	3	2	MORNING	DRIVER_3	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
32	2	8	5	MORNING	DRIVER_2	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
33	2	9	6	MORNING	DRIVER_3	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
38	3	14	9	MORNING	DRIVER_2	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
39	3	15	10	MORNING	DRIVER_3	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
44	4	20	13	MORNING	DRIVER_2	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
45	4	21	14	MORNING	DRIVER_3	2026-04-18	2026-04-18 08:00:00+02	2026-04-18 17:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 13:04:57.474105+02
46	4	22	15	EVENING	DRIVER_1	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 20:10:52.478239+02
29	1	5	3	EVENING	DRIVER_2	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
30	1	6	4	EVENING	DRIVER_3	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
35	2	11	7	EVENING	DRIVER_2	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
36	2	12	8	EVENING	DRIVER_3	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
41	3	17	11	EVENING	DRIVER_2	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
42	3	18	12	EVENING	DRIVER_3	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
47	4	23	15	EVENING	DRIVER_2	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	t	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
48	4	24	16	EVENING	DRIVER_3	2026-04-18	2026-04-18 17:00:00+02	2026-04-19 02:00:00+02	f	2026-04-18 04:19:40.466296+02	2026-04-18 22:00:32.442284+02
55	1	25	3	MORNING	DRIVER_1	2026-04-29	2026-04-29 09:00:00+03	2026-04-29 18:00:00+03	t	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
56	1	26	3	MORNING	DRIVER_2	2026-04-29	2026-04-29 09:00:00+03	2026-04-29 18:00:00+03	t	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
57	1	27	5	MORNING	DRIVER_3	2026-04-29	2026-04-29 09:00:00+03	2026-04-29 18:00:00+03	f	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
58	1	28	7	EVENING	DRIVER_1	2026-04-29	2026-04-29 18:00:00+03	2026-04-30 03:00:00+03	t	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
59	1	29	7	EVENING	DRIVER_2	2026-04-29	2026-04-29 18:00:00+03	2026-04-30 03:00:00+03	t	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
60	1	30	8	EVENING	DRIVER_3	2026-04-29	2026-04-29 18:00:00+03	2026-04-30 03:00:00+03	f	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
\.


--
-- Data for Name: route_stops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_stops (id, route_id, stop_name, sequence_order, latitude, longitude, dwell_time_minutes, created_at) FROM stdin;
1	1	Ramses Garage	1	30.0636	31.2474	2	2026-04-17 23:04:57.902634+02
2	1	Abbaseya	2	30.0744	31.2753	2	2026-04-17 23:04:57.902634+02
3	1	Makram Ebeid	3	30.065	31.335	2	2026-04-17 23:04:57.902634+02
4	1	Abbas El Akkad	4	30.06	31.34	2	2026-04-17 23:04:57.902634+02
5	2	Ramses Garage	1	30.0636	31.2474	2	2026-04-17 23:04:57.902634+02
6	2	Sayeda Zeinab	2	30.03	31.235	2	2026-04-17 23:04:57.902634+02
7	2	Corniche El Maadi	3	29.96	31.25	2	2026-04-17 23:04:57.902634+02
8	2	Grand Mall	4	29.965	31.265	2	2026-04-17 23:04:57.902634+02
9	3	Ramses Garage	1	30.0636	31.2474	2	2026-04-17 23:04:57.902634+02
10	3	Nasr City	2	30.05	31.3	2	2026-04-17 23:04:57.902634+02
11	3	90th Street	3	30.02	31.42	2	2026-04-17 23:04:57.902634+02
12	3	Downtown Mall	4	30.01	31.43	2	2026-04-17 23:04:57.902634+02
13	4	Ramses Garage	1	30.0636	31.2474	2	2026-04-17 23:04:57.902634+02
14	4	Tahrir Square	2	30.0444	31.2357	2	2026-04-17 23:04:57.902634+02
15	4	Dokki	3	30.038	31.212	2	2026-04-17 23:04:57.902634+02
16	4	Giza Square	4	30.015	31.205	2	2026-04-17 23:04:57.902634+02
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.routes (id, name, start_location, end_location, distance_km, estimated_time_minutes, fare, turnaround_time_minutes, is_active, created_at, updated_at) FROM stdin;
1	Ramses - Nasr City	Ramses Garage	Nasr City (Abbas El Akkad)	12.5	45	8	10	t	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
2	Ramses - Maadi	Ramses Garage	Maadi (Grand Mall)	18.2	60	12	10	t	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
3	Ramses - 5th Settlement	Ramses Garage	5th Settlement (Downtown Mall)	25	75	15	15	t	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
4	Ramses - Giza	Ramses Garage	Giza Square	8	30	5	10	t	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, ticket_code, trip_id, passenger_name, seat_number, price, status, purchase_time, validation_time, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: trips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trips (id, driver_id, vehicle_id, route_id, rotation_assignment_id, direction, status, trip_number, scheduled_start, scheduled_end, actual_start, actual_end, passenger_count, crowding_score, is_crowded, driver_crowding_report, fare_collected, is_extra_dispatch, is_late, notes, created_at, updated_at) FROM stdin;
49	1	1	1	25	OUTBOUND	SCHEDULED	TRP-1-0-O	2026-04-18 08:00:00+02	2026-04-18 08:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
50	1	1	1	25	INBOUND	SCHEDULED	TRP-1-0-I	2026-04-18 09:00:00+02	2026-04-18 09:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
51	2	1	1	26	OUTBOUND	SCHEDULED	TRP-1-1-O	2026-04-18 10:00:00+02	2026-04-18 10:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
52	2	1	1	26	INBOUND	SCHEDULED	TRP-1-1-I	2026-04-18 11:00:00+02	2026-04-18 11:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
53	3	2	1	27	OUTBOUND	SCHEDULED	TRP-1-2-O	2026-04-18 09:00:00+02	2026-04-18 09:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
54	3	2	1	27	INBOUND	SCHEDULED	TRP-1-2-I	2026-04-18 10:00:00+02	2026-04-18 10:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
55	4	3	1	28	OUTBOUND	SCHEDULED	TRP-1-0-O	2026-04-18 17:00:00+02	2026-04-18 17:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
56	4	3	1	28	INBOUND	SCHEDULED	TRP-1-0-I	2026-04-18 18:00:00+02	2026-04-18 18:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
57	5	3	1	29	OUTBOUND	SCHEDULED	TRP-1-1-O	2026-04-18 19:00:00+02	2026-04-18 19:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
58	5	3	1	29	INBOUND	SCHEDULED	TRP-1-1-I	2026-04-18 20:00:00+02	2026-04-18 20:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
61	7	5	2	31	OUTBOUND	SCHEDULED	TRP-2-0-O	2026-04-18 08:00:00+02	2026-04-18 09:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
62	7	5	2	31	INBOUND	SCHEDULED	TRP-2-0-I	2026-04-18 09:15:00+02	2026-04-18 10:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
63	8	5	2	32	OUTBOUND	SCHEDULED	TRP-2-1-O	2026-04-18 10:00:00+02	2026-04-18 11:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
64	8	5	2	32	INBOUND	SCHEDULED	TRP-2-1-I	2026-04-18 11:15:00+02	2026-04-18 12:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
65	9	6	2	33	OUTBOUND	SCHEDULED	TRP-2-2-O	2026-04-18 09:00:00+02	2026-04-18 10:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
66	9	6	2	33	INBOUND	SCHEDULED	TRP-2-2-I	2026-04-18 10:15:00+02	2026-04-18 11:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
67	10	7	2	34	OUTBOUND	SCHEDULED	TRP-2-0-O	2026-04-18 17:00:00+02	2026-04-18 18:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
68	10	7	2	34	INBOUND	SCHEDULED	TRP-2-0-I	2026-04-18 18:15:00+02	2026-04-18 19:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
70	11	7	2	35	INBOUND	SCHEDULED	TRP-2-1-I	2026-04-18 20:15:00+02	2026-04-18 21:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
71	12	8	2	36	OUTBOUND	SCHEDULED	TRP-2-2-O	2026-04-18 18:00:00+02	2026-04-18 19:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
72	12	8	2	36	INBOUND	SCHEDULED	TRP-2-2-I	2026-04-18 19:15:00+02	2026-04-18 20:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
73	13	9	3	37	OUTBOUND	SCHEDULED	TRP-3-0-O	2026-04-18 08:00:00+02	2026-04-18 09:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
74	13	9	3	37	INBOUND	SCHEDULED	TRP-3-0-I	2026-04-18 09:30:00+02	2026-04-18 10:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
75	14	9	3	38	OUTBOUND	SCHEDULED	TRP-3-1-O	2026-04-18 10:00:00+02	2026-04-18 11:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
76	14	9	3	38	INBOUND	SCHEDULED	TRP-3-1-I	2026-04-18 11:30:00+02	2026-04-18 12:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
77	15	10	3	39	OUTBOUND	SCHEDULED	TRP-3-2-O	2026-04-18 09:00:00+02	2026-04-18 10:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
78	15	10	3	39	INBOUND	SCHEDULED	TRP-3-2-I	2026-04-18 10:30:00+02	2026-04-18 11:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
79	16	11	3	40	OUTBOUND	SCHEDULED	TRP-3-0-O	2026-04-18 17:00:00+02	2026-04-18 18:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
80	16	11	3	40	INBOUND	SCHEDULED	TRP-3-0-I	2026-04-18 18:30:00+02	2026-04-18 19:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
81	17	11	3	41	OUTBOUND	SCHEDULED	TRP-3-1-O	2026-04-18 19:00:00+02	2026-04-18 20:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
82	17	11	3	41	INBOUND	SCHEDULED	TRP-3-1-I	2026-04-18 20:30:00+02	2026-04-18 21:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
83	18	12	3	42	OUTBOUND	SCHEDULED	TRP-3-2-O	2026-04-18 18:00:00+02	2026-04-18 19:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
84	18	12	3	42	INBOUND	SCHEDULED	TRP-3-2-I	2026-04-18 19:30:00+02	2026-04-18 20:45:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
85	19	13	4	43	OUTBOUND	SCHEDULED	TRP-4-0-O	2026-04-18 08:00:00+02	2026-04-18 08:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
86	19	13	4	43	INBOUND	SCHEDULED	TRP-4-0-I	2026-04-18 08:45:00+02	2026-04-18 09:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
87	20	13	4	44	OUTBOUND	SCHEDULED	TRP-4-1-O	2026-04-18 10:00:00+02	2026-04-18 10:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
88	20	13	4	44	INBOUND	SCHEDULED	TRP-4-1-I	2026-04-18 10:45:00+02	2026-04-18 11:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
89	21	14	4	45	OUTBOUND	SCHEDULED	TRP-4-2-O	2026-04-18 09:00:00+02	2026-04-18 09:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
90	21	14	4	45	INBOUND	SCHEDULED	TRP-4-2-I	2026-04-18 09:45:00+02	2026-04-18 10:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
91	22	15	4	46	OUTBOUND	SCHEDULED	TRP-4-0-O	2026-04-18 17:00:00+02	2026-04-18 17:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
92	22	15	4	46	INBOUND	SCHEDULED	TRP-4-0-I	2026-04-18 17:45:00+02	2026-04-18 18:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
93	23	15	4	47	OUTBOUND	SCHEDULED	TRP-4-1-O	2026-04-18 19:00:00+02	2026-04-18 19:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
94	23	15	4	47	INBOUND	SCHEDULED	TRP-4-1-I	2026-04-18 19:45:00+02	2026-04-18 20:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
95	24	16	4	48	OUTBOUND	SCHEDULED	TRP-4-2-O	2026-04-18 18:00:00+02	2026-04-18 18:30:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
96	24	16	4	48	INBOUND	SCHEDULED	TRP-4-2-I	2026-04-18 18:45:00+02	2026-04-18 19:15:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
69	11	7	2	35	OUTBOUND	SCHEDULED	TRP-2-1-O	2026-04-18 19:00:00+02	2026-04-18 20:00:00+02	\N	\N	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 04:19:40.466296+02
59	6	4	1	30	OUTBOUND	COMPLETED	TRP-1-2-O	2026-04-18 12:04:00+02	2026-04-18 18:45:00+02	2026-04-18 12:01:07.744174+02	2026-04-18 12:41:14.022359+02	0	0	f	f	0	f	f	\N	2026-04-18 04:19:40.466296+02	2026-04-18 12:41:13.997074+02
60	6	4	1	30	INBOUND	COMPLETED	TRP-1-2-I	2026-04-18 13:08:00+02	2026-04-18 13:15:00+02	2026-04-18 13:07:15.473779+02	2026-04-18 13:41:34.050223+02	0	0	f	f	0	f	t	\N	2026-04-18 04:19:40.466296+02	2026-04-18 13:41:34.03498+02
109	25	3	1	55	OUTBOUND	SCHEDULED	TRP-1-0-O	2026-04-29 09:00:00+03	2026-04-29 09:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
110	25	3	1	55	INBOUND	SCHEDULED	TRP-1-0-I	2026-04-29 10:00:00+03	2026-04-29 10:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
111	26	3	1	56	OUTBOUND	SCHEDULED	TRP-1-1-O	2026-04-29 11:00:00+03	2026-04-29 11:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
112	26	3	1	56	INBOUND	SCHEDULED	TRP-1-1-I	2026-04-29 12:00:00+03	2026-04-29 12:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
113	27	5	1	57	OUTBOUND	SCHEDULED	TRP-1-2-O	2026-04-29 10:00:00+03	2026-04-29 10:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
114	27	5	1	57	INBOUND	SCHEDULED	TRP-1-2-I	2026-04-29 11:00:00+03	2026-04-29 11:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
115	28	7	1	58	OUTBOUND	SCHEDULED	TRP-1-0-O	2026-04-29 18:00:00+03	2026-04-29 18:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
116	28	7	1	58	INBOUND	SCHEDULED	TRP-1-0-I	2026-04-29 19:00:00+03	2026-04-29 19:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
117	29	7	1	59	OUTBOUND	SCHEDULED	TRP-1-1-O	2026-04-29 20:00:00+03	2026-04-29 20:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
118	29	7	1	59	INBOUND	SCHEDULED	TRP-1-1-I	2026-04-29 21:00:00+03	2026-04-29 21:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
119	30	8	1	60	OUTBOUND	SCHEDULED	TRP-1-2-O	2026-04-29 19:00:00+03	2026-04-29 19:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
120	30	8	1	60	INBOUND	SCHEDULED	TRP-1-2-I	2026-04-29 20:00:00+03	2026-04-29 20:45:00+03	\N	\N	0	0	f	f	0	f	f	\N	2026-04-29 00:36:31.556553+03	2026-04-29 00:36:31.556553+03
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, hashed_password, full_name, role, phone, preferred_language, is_active, is_email_verified, email_verification_token, password_reset_token, password_reset_expires, created_at, updated_at) FROM stdin;
1	admin@smartbus.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	System Admin	ADMIN	+201001234567	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
2	admin2@smartbus.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	Admin Backup	ADMIN	+201001234568	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
3	manager1@smartbus.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	Manager 1	MANAGER	+201002000001	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
4	manager2@smartbus.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	Manager 2	MANAGER	+201002000002	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
5	manager3@smartbus.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	Manager 3	MANAGER	+201002000003	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
6	lamia.hamdy@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	لمياء حمدي درويش	DRIVER	+201003000001	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
7	heba.fathy@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	هبة فتحي عرفة	DRIVER	+201003000002	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
8	khaled.saeed@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	خالد سعيد عبدالعزيز	DRIVER	+201003000003	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
9	sami.kamel@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	سامي كامل خليل	DRIVER	+201003000004	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
10	ghada.mansour@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	غادة منصور عوض	DRIVER	+201003000005	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
11	mostafa.rafat@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	مصطفى رأفت طلعت	DRIVER	+201003000006	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
12	adel.kamel@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	عادل كامل عطية	DRIVER	+201003000007	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
13	eman.samir@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	إيمان سمير طلعت	DRIVER	+201003000008	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
14	khaled.mansour@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	خالد منصور خليل	DRIVER	+201003000009	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
15	dina.saeed@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	دينا سعيد عطية	DRIVER	+201003000010	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
16	mariam.abdallah@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	مريم عبدالله سليمان	DRIVER	+201003000011	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
17	hany.ezzat@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	هاني عزت عطية	DRIVER	+201003000012	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
19	yasmin.zaki@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	ياسمين زكي العقاد	DRIVER	+201003000014	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
20	karim.zaki@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	كريم زكي عرفة	DRIVER	+201003000015	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
21	nabil.hamdy@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	نبيل حمدي قاسم	DRIVER	+201003000016	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
22	reham.hussein@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	ريهام حسين طلعت	DRIVER	+201003000017	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
23	maged.tharwat@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	ماجد ثروت الشيخ	DRIVER	+201003000018	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
24	mostafa.zaki@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	مصطفى زكي غنيم	DRIVER	+201003000019	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
25	ibrahim.ibrahim@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	إبراهيم إبراهيم مرسي	DRIVER	+201003000020	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
26	adel.hamdy@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	عادل حمدي المهدي	DRIVER	+201003000021	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
27	hossam.ibrahim@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	حسام إبراهيم بركات	DRIVER	+201003000022	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
28	mohamed.rashad@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	محمد رشاد عبدالرحمن	DRIVER	+201003000023	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
29	yasmin.mohamed2@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	ياسمين محمد الشيخ	DRIVER	+201003000024	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
30	youssef.fathy@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	يوسف فتحي سليمان	DRIVER	+201003000025	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
31	adel.bahaa@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	عادل بهاء العقاد	DRIVER	+201003000026	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
32	mostafa.ezzat@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	مصطفى عزت السيد	DRIVER	+201003000027	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
33	hanaa.tharwat@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	هناء ثروت العقاد	DRIVER	+201003000028	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
34	mona.samir@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	منى سمير عبدالعزيز	DRIVER	+201003000029	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
35	ibrahim.zaki@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	إبراهيم زكي خليل	DRIVER	+201003000030	en	t	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
18	yasmin.mohamed@busgarage.com	$2b$12$rn0Va2XNdaRa21xw.ZoL..e41rC508CPozlvVzcfDXaJfNGmOru1i	ياسمين محمد البدري	DRIVER	+201003000013	en	f	f	\N	\N	\N	2026-04-17 23:04:57.902634+02	2026-04-18 12:48:40.920124+02
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicles (id, plate_number, model, year, capacity, status, garage_id, current_latitude, current_longitude, mileage, fuel_level, last_maintenance_date, created_at, updated_at) FROM stdin;
3	ABC-103	Mercedes Conecto	2024	40	FREE	1	\N	\N	4500	57.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
5	ABC-105	MAN Lion's City	2022	50	FREE	1	\N	\N	7500	62.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
7	ABC-107	Volvo 9700	2023	45	FREE	1	\N	\N	10500	67.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
8	ABC-108	MAN Lion's City	2022	55	FREE	1	\N	\N	12000	70	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
9	ABC-109	Mercedes Conecto	2024	40	FREE	1	\N	\N	13500	72.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
10	ABC-110	Volvo 9700	2023	60	FREE	1	\N	\N	15000	75	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
11	ABC-111	MAN Lion's City	2022	50	FREE	1	\N	\N	16500	77.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
12	ABC-112	Mercedes Conecto	2024	50	FREE	1	\N	\N	18000	80	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
13	ABC-113	Volvo 9700	2023	45	FREE	1	\N	\N	19500	82.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
14	ABC-114	MAN Lion's City	2022	55	FREE	1	\N	\N	21000	85	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
15	ABC-115	Mercedes Conecto	2024	40	FREE	1	\N	\N	22500	87.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
16	ABC-116	Volvo 9700	2023	60	FREE	1	\N	\N	24000	90	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
17	ABC-117	MAN Lion's City	2022	50	FREE	1	\N	\N	25500	92.5	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
18	ABC-118	Mercedes Conecto	2024	50	FREE	1	\N	\N	27000	95	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
4	ABC-104	Volvo 9700	2023	60	FREE	1	\N	\N	6000	60	\N	2026-04-17 23:04:57.902634+02	2026-04-18 13:41:34.03498+02
1	ABC-200	Volvo 9700	2023	45	MAINTENANCE	1	\N	\N	1500	52.5	\N	2026-04-17 23:04:57.902634+02	2026-04-18 11:18:41.489088+02
2	ABC101	MAN Lion's City	2022	55	FREE	1	\N	\N	3000	55	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
6	Hi	Mercedes Conecto	2024	50	FREE	1	\N	\N	9000	65	\N	2026-04-17 23:04:57.902634+02	2026-04-17 23:04:57.902634+02
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 38, true);


--
-- Name: break_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.break_logs_id_seq', 1, false);


--
-- Name: camera_readings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.camera_readings_id_seq', 1, false);


--
-- Name: crowding_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crowding_events_id_seq', 1, false);


--
-- Name: daily_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_reports_id_seq', 1, false);


--
-- Name: driver_exchanges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.driver_exchanges_id_seq', 24, true);


--
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.drivers_id_seq', 30, true);


--
-- Name: garages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.garages_id_seq', 1, true);


--
-- Name: gate_cameras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gate_cameras_id_seq', 1, false);


--
-- Name: gate_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gate_logs_id_seq', 55, true);


--
-- Name: gps_tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gps_tracking_id_seq', 1, false);


--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.maintenance_requests_id_seq', 3, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 9, true);


--
-- Name: reroute_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reroute_logs_id_seq', 5, true);


--
-- Name: rotation_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rotation_assignments_id_seq', 60, true);


--
-- Name: route_stops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_stops_id_seq', 16, true);


--
-- Name: routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.routes_id_seq', 4, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, false);


--
-- Name: trips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trips_id_seq', 120, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 35, true);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 18, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: break_logs break_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.break_logs
    ADD CONSTRAINT break_logs_pkey PRIMARY KEY (id);


--
-- Name: camera_readings camera_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_readings
    ADD CONSTRAINT camera_readings_pkey PRIMARY KEY (id);


--
-- Name: crowding_events crowding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crowding_events
    ADD CONSTRAINT crowding_events_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_report_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_report_date_key UNIQUE (report_date);


--
-- Name: driver_exchanges driver_exchanges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges
    ADD CONSTRAINT driver_exchanges_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_license_number_key UNIQUE (license_number);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


--
-- Name: garages garages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_pkey PRIMARY KEY (id);


--
-- Name: gate_cameras gate_cameras_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_cameras
    ADD CONSTRAINT gate_cameras_ip_address_key UNIQUE (ip_address);


--
-- Name: gate_cameras gate_cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_cameras
    ADD CONSTRAINT gate_cameras_pkey PRIMARY KEY (id);


--
-- Name: gate_logs gate_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_logs
    ADD CONSTRAINT gate_logs_pkey PRIMARY KEY (id);


--
-- Name: gps_tracking gps_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_tracking
    ADD CONSTRAINT gps_tracking_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: reroute_logs reroute_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_pkey PRIMARY KEY (id);


--
-- Name: rotation_assignments rotation_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments
    ADD CONSTRAINT rotation_assignments_pkey PRIMARY KEY (id);


--
-- Name: route_stops route_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: rotation_assignments uix_rotation_assignment; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments
    ADD CONSTRAINT uix_rotation_assignment UNIQUE (route_id, shift_type, "position", shift_date);


--
-- Name: route_stops uix_route_stop_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT uix_route_stop_order UNIQUE (route_id, sequence_order);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_plate_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_number_key UNIQUE (plate_number);


--
-- Name: idx_crowding_trip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crowding_trip ON public.crowding_events USING btree (trip_id);


--
-- Name: idx_gps_vehicle_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gps_vehicle_time ON public.gps_tracking USING btree (vehicle_id, recorded_at);


--
-- Name: ix_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: ix_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: ix_audit_logs_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_audit_logs_user_created ON public.audit_logs USING btree (user_id, created_at);


--
-- Name: ix_break_logs_driver_shift_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_break_logs_driver_shift_date ON public.break_logs USING btree (driver_id, shift_date);


--
-- Name: ix_break_logs_driver_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_break_logs_driver_start_time ON public.break_logs USING btree (driver_id, start_time);


--
-- Name: ix_camera_readings_trip_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_readings_trip_id ON public.camera_readings USING btree (trip_id);


--
-- Name: ix_camera_readings_vehicle_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_readings_vehicle_created ON public.camera_readings USING btree (vehicle_id, created_at);


--
-- Name: ix_driver_exchanges_rotation_assignment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_driver_exchanges_rotation_assignment_id ON public.driver_exchanges USING btree (rotation_assignment_id);


--
-- Name: ix_drivers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_drivers_status ON public.drivers USING btree (status);


--
-- Name: ix_gate_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_gate_logs_created_at ON public.gate_logs USING btree (created_at);


--
-- Name: ix_gate_logs_plate_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_gate_logs_plate_created ON public.gate_logs USING btree (plate_number, created_at);


--
-- Name: ix_maint_requests_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_maint_requests_status_created ON public.maintenance_requests USING btree (status, created_at);


--
-- Name: ix_maint_requests_vehicle_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_maint_requests_vehicle_id ON public.maintenance_requests USING btree (vehicle_id);


--
-- Name: ix_notifications_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_notifications_user_created ON public.notifications USING btree (user_id, created_at);


--
-- Name: ix_notifications_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_notifications_user_status ON public.notifications USING btree (user_id, status);


--
-- Name: ix_reroute_logs_driver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_reroute_logs_driver_id ON public.reroute_logs USING btree (driver_id);


--
-- Name: ix_reroute_logs_status_requested; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_reroute_logs_status_requested ON public.reroute_logs USING btree (status, requested_at);


--
-- Name: ix_rotation_assignments_shift_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_rotation_assignments_shift_date ON public.rotation_assignments USING btree (shift_date);


--
-- Name: ix_routes_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_routes_is_active ON public.routes USING btree (is_active);


--
-- Name: ix_tickets_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tickets_created_at ON public.tickets USING btree (created_at);


--
-- Name: ix_tickets_ticket_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_tickets_ticket_code ON public.tickets USING btree (ticket_code);


--
-- Name: ix_tickets_trip_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tickets_trip_id ON public.tickets USING btree (trip_id);


--
-- Name: ix_tickets_trip_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tickets_trip_status ON public.tickets USING btree (trip_id, status);


--
-- Name: ix_trips_driver_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_driver_scheduled ON public.trips USING btree (driver_id, scheduled_start);


--
-- Name: ix_trips_route_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_route_scheduled ON public.trips USING btree (route_id, scheduled_start);


--
-- Name: ix_trips_scheduled_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_scheduled_start ON public.trips USING btree (scheduled_start);


--
-- Name: ix_trips_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_status ON public.trips USING btree (status);


--
-- Name: ix_trips_status_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_status_scheduled ON public.trips USING btree (status, scheduled_start);


--
-- Name: ix_trips_vehicle_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trips_vehicle_scheduled ON public.trips USING btree (vehicle_id, scheduled_start);


--
-- Name: ix_users_email_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email_verification_token ON public.users USING btree (email_verification_token);


--
-- Name: ix_users_password_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_password_reset_token ON public.users USING btree (password_reset_token);


--
-- Name: ix_users_role_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_role_is_active ON public.users USING btree (role, is_active);


--
-- Name: ix_vehicles_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_vehicles_status ON public.vehicles USING btree (status);


--
-- Name: uix_tickets_trip_seat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uix_tickets_trip_seat ON public.tickets USING btree (trip_id, seat_number) WHERE (seat_number IS NOT NULL);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: break_logs break_logs_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.break_logs
    ADD CONSTRAINT break_logs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: break_logs break_logs_replaced_by_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.break_logs
    ADD CONSTRAINT break_logs_replaced_by_driver_id_fkey FOREIGN KEY (replaced_by_driver_id) REFERENCES public.drivers(id);


--
-- Name: camera_readings camera_readings_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_readings
    ADD CONSTRAINT camera_readings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: camera_readings camera_readings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_readings
    ADD CONSTRAINT camera_readings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: crowding_events crowding_events_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crowding_events
    ADD CONSTRAINT crowding_events_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: crowding_events crowding_events_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crowding_events
    ADD CONSTRAINT crowding_events_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: driver_exchanges driver_exchanges_incoming_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges
    ADD CONSTRAINT driver_exchanges_incoming_driver_id_fkey FOREIGN KEY (incoming_driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_exchanges driver_exchanges_outgoing_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges
    ADD CONSTRAINT driver_exchanges_outgoing_driver_id_fkey FOREIGN KEY (outgoing_driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_exchanges driver_exchanges_rotation_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges
    ADD CONSTRAINT driver_exchanges_rotation_assignment_id_fkey FOREIGN KEY (rotation_assignment_id) REFERENCES public.rotation_assignments(id);


--
-- Name: driver_exchanges driver_exchanges_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_exchanges
    ADD CONSTRAINT driver_exchanges_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: drivers drivers_current_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_current_route_id_fkey FOREIGN KEY (current_route_id) REFERENCES public.routes(id);


--
-- Name: drivers drivers_current_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_current_vehicle_id_fkey FOREIGN KEY (current_vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: drivers drivers_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(id);


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gate_logs gate_logs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gate_logs
    ADD CONSTRAINT gate_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: gps_tracking gps_tracking_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_tracking
    ADD CONSTRAINT gps_tracking_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: gps_tracking gps_tracking_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_tracking
    ADD CONSTRAINT gps_tracking_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: maintenance_requests maintenance_requests_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: maintenance_requests maintenance_requests_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: maintenance_requests maintenance_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reroute_logs reroute_logs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: reroute_logs reroute_logs_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: reroute_logs reroute_logs_new_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_new_route_id_fkey FOREIGN KEY (new_route_id) REFERENCES public.routes(id);


--
-- Name: reroute_logs reroute_logs_original_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_original_route_id_fkey FOREIGN KEY (original_route_id) REFERENCES public.routes(id);


--
-- Name: reroute_logs reroute_logs_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reroute_logs
    ADD CONSTRAINT reroute_logs_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: rotation_assignments rotation_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments
    ADD CONSTRAINT rotation_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: rotation_assignments rotation_assignments_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments
    ADD CONSTRAINT rotation_assignments_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: rotation_assignments rotation_assignments_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rotation_assignments
    ADD CONSTRAINT rotation_assignments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: route_stops route_stops_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: tickets tickets_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: trips trips_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: trips trips_rotation_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_rotation_assignment_id_fkey FOREIGN KEY (rotation_assignment_id) REFERENCES public.rotation_assignments(id);


--
-- Name: trips trips_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: trips trips_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: vehicles vehicles_garage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_garage_id_fkey FOREIGN KEY (garage_id) REFERENCES public.garages(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict My3ltfI3RCBAdIU3fXYa3SaZ9cO3PARy2S9cgskOOac8sVbsBtsezNjQtEwDOD3

