# Features

- Integrate chat bot window
    - when prompting, have the chatbot take into account the current team information
        - This is particularly important for when the chat bot is "checking" your team (analyzing strengths, weaknesses and pain-point pokemon)
- Add a way to login/setup an account
- Formatting changes
    - THIS IS THE MOST IMPORTANT CHANGE:
    - The ui is going to be the primary way of  differentiating the app from its competition, particularly through the creation of a unique visual identity
    - New font
    - Change the emojis
- Look into how much getting ads would be
- Add fun gimmick teambuilding styles (like fan formats in showdown)
- Create a "hero shooter" categorization for pokemon selection
    - Defined roles (not official, more vibes based)
    - Multiple pokemon can go in multiple categories, though there needs to be a distinction as to why they were placed in a given category (arcanine has intimidate for disruption but also solid attacking stats)
    - This could be a selectable filter or a clickable icon that then applys the filter
    - it also could look like the tags that already exist in the app (as of july 6th, 2026) for regional forms and mega evolutions
# setup
bun install
bun dev

# dev workflow
1. make changes
2. review changes through the git difference view in vscode
3. make sure theres no secrets/database files
4. stage changes `git add .`
5. commit changes `git commit -m "some comment"`
6. pull latest changes from origin `git pull`
7. push changes to origin `git push`