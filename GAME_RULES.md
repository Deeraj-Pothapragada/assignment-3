# Murder Mystery: The Game

A social deduction game for 4+ players and 1 Game Master.

## Overview

Players take on secret roles and must either identify the murderer or survive as the murderer without being caught. Through a series of nights and days, players gather information, make deductions, and try to achieve their win condition.

## Setup

### Players
- **4 Playing Players**
- **1 Game Master** (orchestrates the game, does not play)

### Roles
The Game Master randomly assigns roles in secret:
- **1 Murderer**: Tries to eliminate all innocents without being caught
- **All others are Innocents**: Try to identify and vote out the murderer

## Game Phases

The game proceeds through repeating cycles:

```
Day 0 (Introductions) → Night 1 → Day 1 → Night 2 → Day 2 → ...
```

### Day 0: Introductions

1. The Game Master tells each player their secret role privately (whisper or written note)
2. Players introduce themselves to the group (a sentence or so)

### Night Phase

**All alive players simultaneously choose one action:**
- **Stay home** (remain at their own location)
- **Visit another player's HOME** (go to that player's home)

**How to play:**
- Each player whispers their choice to the Game Master
- The Murderer additionally indicates whether they have "intent to kill" (yes/no)
- All players submit their choices before any results are revealed

**Night Resolution:**

The Game Master determines what happens:

1. **Locations**: Group players by their final locations (homes)
   - Players who stayed home are at their own location
   - Players who visited are at the visited player's home

2. **Killing**:
   - **3 or more people** at the same home → The murder doesn't even attempt to kill, because of witnesses.
   - **2 people** at a home AND the murderer is there with intent → The other person dies.
   - **1 person** alone at a home → Safe (no one to kill them or be killed by them)

3. **The Murderer's Constraint**: The murderer must attempt to kill at least once every two nights. (i.e it is illegal to not attempt to kill for two consecutive nights)

**What Players Learn:**

After night resolution, the Game Master tells each player privately:
- **Who you saw**: The names of all other people at your location (this is a FACT)
- **Who died**: If someone died, announce the name to all players (it is implied that every killed person is innocent, because the murderer can't be killed overnight)
- **Special notifications**: If the murderer's kill was blocked, tell them privately (This is grouped together with the information about who they saw at the home they visited)

### Day Phase: Discussion

1. **Death Announcement**: The Game Master announces if anyone died last night (names)

2. **Statements Round**: Each player makes a public statement to the group
   - Players can share what they saw, make accusations, or tell lies
   - Players all submit their statements at the same time, and the Game Master announces them all at once. (i.e it is not a 'discussion, players cannot see other peoples statements until the Game Master announces them all at once).
   - Intuitively, everything said cannot be taken for fact, because the murderer can and should lie.

3. The Game Master should ensure everyone submits a statement.

### Day Phase: Voting

AFTER EVERYONE HEARS EACHOTHERS STATEMENTS:
1. **Voting Round**: Each player reasons about what they know for fact, and what they've heard, andvotes simultaneously
   - Vote to hang one player, OR
   - Abstain (choose not to vote)

**How to vote:**
- Players whisper their vote to the Game Master
- Format: Player name or "abstain"

**Vote Resolution:**

The Game Master counts the votes:
- **Threshold**: Need more than 50% of non-abstaining votes, with a minimum of 2 votes
- **Ties**: No one is hanged
- **If someone is hanged**:
  - That player is eliminated
  - The Game Master reveals their role to all players
  - The hanged player cannot speak or participate further

**Examples:**
- 4 votes total: Need 3 votes on one person (more than 50% of 4 = 3)
- 3 vote, 1 abstains: Need 2 votes on one person (more than 50% of 3 = 2)
- 2 vote Alice, 1 votes Bob, 1 abstains: Alice is hanged (2 out of 3 voting)
- 2 vote Alice, 2 vote Bob: TIE, no one hanged

## Information Rules

Understanding what information you have is crucial:

### FACTS (100% True)
Things you directly witnessed:
- Who was at your location during the night
- Role reveals when someone is hanged

### ALLEGED INFO (May Be Lies)
Things other players told you:
- Their introductions
- Their statements during day discussion
- Their claims about where they went

**Remember**: The murderer can and should lie! Just because someone said it doesn't make it true.

## Win Conditions

### Innocents Win If:
- The murderer is hanged during any voting phase

### Murderer Wins If:
- All innocents are dead, OR
- The game reaches a 1-vs-1 situation (murderer and one innocent remain)

## Strategy Tips

### For Innocents:
- Share what you actually saw (your facts)
- Look for contradictions in what people claim, especially if you have facts that contradict what they say.
- Work together to catch the murderer in a lie

### For the Murderer:
- Blend in by acting like an innocent
- Carefully craft lies that can't be disproven
- Try to create suspicion between innocents
- Remember to kill regularly (at least every other night) technically, you are just forced to attempt to kill every other night at which your only choice becomes to stay home and attempt to kill or visit a home and attempt to kill.


## Game Master Duties

The Game Master must:
1. **Assign roles** randomly and secretly at the start (Use a RNG to assign roles)
2. **Collect actions** during night and voting phases (Make sure other players cannot hear/see other players' actions)
3. **Resolve nights** using the location and killing rules
4. **Distribute information** carefully:
   - Tell each player only what they witnessed
   - Announce deaths (name only)
   - Reveal roles only when someone is hanged
5. **Track the killing constraint** for the murderer
6. **Maintain secrecy** - never reveal information players shouldn't know
7. **Announce win conditions** when the game ends

## Example Round

**Night 1:**
- Alice stays home
- Bob visits Alice (no intent to kill - he's innocent)
- Charlie visits David (intent to kill - he's the murderer)
- David stays home

**Resolution:**
- Alice's location: Alice, Bob (2 people, safe)
- David's location: David, Charlie (2 people, murderer with intent → David DIES)

**What players learn:**
- Alice learns: "You were at your location. Bob was also there."
- Bob learns: "You were at Alice's location. Alice was also there."
- Charlie learns: "You were at David's location. David was also there. [Private: Your kill was successful.]"
- David: (dead, learns nothing)

**Day 1 Announcement:**
"Last night, David died."

**Statements:**
- Alice: "I stayed home. Bob came to visit me."
- Bob: "I visited Alice. We can confirm each other."
- Charlie: "I stayed home alone all night." (LIE!)

**Voting:**
- Alice votes: Charlie (suspicious he has no alibi)
- Bob votes: Charlie (agrees with Alice)
- Charlie votes: Bob (trying to deflect)
- Result: 2 votes for Charlie, 1 for Bob → **Charlie is hanged**

**Game Master reveals:** "Charlie was the MURDERER. Innocents win!"


**Ready to play?** Gather your friends, choose a Game Master, and see who can survive the night!
