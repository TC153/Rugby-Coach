/** All distances in metres, times in seconds. Attack runs towards +y. */
export const PITCH_W = 70;
export const TRY_LINE_Y = 50;
export const DEAD_BALL_Y = 60;
export const HALFWAY_Y = 0;

export const LANES = 5;
export const LANE_SPACING = 7;
export const CENTRE_X = PITCH_W / 2;

export const ATT_START_Y = 4;
export const DEF_START_Y = 27;

export const CARRIER_SPEED = 5.6;
export const SUPPORT_MAX_SPEED = 7.4;
export const SUPPORT_MIN_SPEED = 2.2;
/** How far behind the ball carrier each lane steps back along the pass line. */
export const DEPTH_STEP = 2.4;

export const BALL_SPEED = 17;
export const MIN_PASS_TIME = 0.22;
/** A pass is forward if the catch point is more than this ahead of the release point. */
export const FORWARD_TOLERANCE = 0.4;

export const LINE_SPEED = 2.4;
export const DEF_LATERAL_SPEED = 5.4;
export const DEF_FORWARD_SPEED = 5.0;
export const TACKLER_SPEED = 6.4;
export const DEF_ACCEL = 16;
/** Defenders cheat towards the ball by this fraction of the distance. */
export const DEF_SLIDE = 0.18;
/** Seconds of lag in how fast defenders read where the ball is. */
export const DEF_REACTION = 0.4;
export const TACKLE_TRIGGER = 6.5;
export const TACKLE_CONTACT = 1.25;
export const OVERRAN_TIME = 0.75;
export const OVERRAN_LATERAL_SPEED = 1.6;
export const BEATEN_TIME = 1.3;
/** A tackle is made if 3d6 plus modifiers reaches this number. */
export const TACKLE_TARGET = 7;

export const RESET_DELAY = 1.7;
export const PLAYER_R = 0.9;

/** Lateral drift (m/s) per lane away from the middle lane. */
export const FAN_OUT = 0.9;

/** A defender with the ball this far past him gives up the line and chases. */
export const BEATEN_MARGIN = 1.0;
export const CHASE_SPEED = 5.9;

/** Passing (3d6 at release). Total + modifiers at or below these is a missed / poor pass. */
export const PASS_MISSED_MAX = 4;
export const PASS_POOR_MAX = 7;
/** Passer has a defender this close when he lets it go: hurried pass. */
export const HURRIED_DIST = 2.2;
/** Catching (3d6 at arrival): dropped if total is at or below CATCH_FAIL_BASE + penalties. */
export const CATCH_FAIL_BASE = 4;
/** Receiver has a defender this close as the ball arrives: catching under pressure. */
export const PRESSURE_DIST = 2.5;
/** A defender this close to the ball in flight gets a chance to intercept. */
export const INTERCEPT_R = 1.1;
/** 3d6 needed to pick off a pass. */
export const INTERCEPT_NEED = 14;
/** The receiver counts as in front of the passer (forward pass) beyond this. */
export const AHEAD_TOLERANCE = 0.3;
