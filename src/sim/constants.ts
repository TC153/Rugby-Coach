/** All distances in metres, times in seconds. Attack runs towards +y. */
export const PITCH_W = 70;
export const TRY_LINE_Y = 50;
export const DEAD_BALL_Y = 60;
export const HALFWAY_Y = 0;
export const CENTRE_X = PITCH_W / 2;

export const PER_SIDE = 8;
/** First ruck of each attack. */
export const START_RUCK_Y = 10;

export const CARRIER_SPEED = 5.6;
export const SUPPORT_MAX_SPEED = 7.4;
export const SUPPORT_MIN_SPEED = 2.2;
/** How far behind the ball carrier each lane steps back along the pass line. */
export const DEPTH_STEP = 2.2;
/** Lateral drift (m/s) away from the carrier, so the line keeps its width. */
export const FAN_OUT = 0.5;

export const BALL_SPEED = 17;
export const MIN_PASS_TIME = 0.22;
/** A pass is forward if the catch point is more than this ahead of the passer's hands. */
export const FORWARD_TOLERANCE = 0.4;
/** The receiver counts as in front of the passer (forward pass) beyond this. */
export const AHEAD_TOLERANCE = 0.3;

export const LINE_SPEED = 2.6;
export const DEF_LATERAL_SPEED = 5.4;
export const DEF_FORWARD_SPEED = 5.0;
export const TACKLER_SPEED = 6.4;
export const DEF_ACCEL = 16;
/** Defenders cheat towards the ball by this fraction of the distance. */
export const DEF_SLIDE = 0.15;
/** Seconds of lag in how fast defenders read where the ball is. */
export const DEF_REACTION = 0.4;
export const TACKLE_TRIGGER = 6.0;
export const TACKLE_CONTACT = 1.25;
export const OVERRAN_TIME = 0.75;
export const OVERRAN_LATERAL_SPEED = 1.6;
export const BEATEN_TIME = 1.3;
/** A tackle is made if 3d6 plus modifiers reaches this number. */
export const TACKLE_TARGET = 7;
/** A defender with the ball this far past him gives up the line and chases. */
export const BEATEN_MARGIN = 1.0;
export const CHASE_SPEED = 5.9;

export const RESET_DELAY = 1.8;
export const PLAYER_R = 0.9;

/** Passing (3d6 at release). Total + modifiers at or below these is a missed / poor pass. */
export const PASS_MISSED_MAX = 3;
export const PASS_POOR_MAX = 6;
/** Passer has a defender this close when he lets it go: hurried pass. */
export const HURRIED_DIST = 2.2;
/** Catching (3d6 at arrival): dropped if total is at or below CATCH_FAIL_BASE + penalties. */
export const CATCH_FAIL_BASE = 4;
/** Receiver has a defender this close as the ball arrives: catching under pressure. */
export const PRESSURE_DIST = 2.0;
/** Receiver was not in position when the ball came out of the ruck. */
export const UNSET_PENALTY = 2;
/** A defender this close to the ball in flight gets a chance to intercept. */
export const INTERCEPT_R = 1.1;
/** 3d6 needed to pick off a pass. */
export const INTERCEPT_NEED = 14;

// ---- Ruck ----
/** World runs at this fraction of real time while the coach decides. */
export const RUCK_TIMESCALE = 0.5;
/** Without a call the ball comes out at this clock time (or when ready, if later). */
export const DECISION_MAX = 6;
export const RUCK_READY_MIN = 2.5;
export const RUCK_READY_MAX = 6;
/** Contest is settled once everyone committed has arrived, or at this clock time. */
export const RUCK_FORM_MAX = 5.0;
/** Readiness after the contest settles: base, per defender, jackal, per spare cleaner. */
export const RUCK_BASE = 0.9;
export const RUCK_PER_DEFENDER = 1.1;
export const RUCK_JACKAL = 1.0;
export const RUCK_PER_SPARE_CLEANER = 0.35;
/** Contest: keep the ball if 3d6 + 2 x (cleaners - defenders) - jackal reaches this. */
export const RUCK_KEEP = 7;
export const RUCK_JACKAL_PENALTY = 3;
/** Defenders this close to the tackle may commit to the ruck. */
export const DEF_COMMIT_DIST = 5;
export const DEF_COMMIT_CHANCE = [0.85, 0.5];
export const CLEANER_SPEED = 7.0;
export const DEF_RUCK_SPEED = 6.2;
export const REALIGN_SPEED_ATT = 6.5;
export const REALIGN_SPEED_DEF = 5.0;
/** Attack runners stand off the ruck: first one this wide, then this spacing. */
export const SLOT_FIRST = 4;
export const SLOT_SPACING = 5.5;
export const SLOT_DEPTH = 2.5;
export const SLOT_DEPTH_STEP = 1.0;
/** Close enough to his slot to count as set. */
export const SET_DIST = 1.6;
/** Defence offside line: back foot of the ruck. */
export const DEF_OFFSIDE = 1.6;
/** Seconds ruck players stay down/bound after the ball comes out. */
export const RUCK_REJOIN = 1.4;
