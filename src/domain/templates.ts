export const CODE_TEMPLATES = {
  PREDATOR: `def action(cell, environment):
    if environment["e"] == "enemy":
        return "ae"
    if environment["ne"] == "enemy":
        return "ane"
    if environment["se"] == "enemy":
        return "ase"
    if cell["health"] >= 50 and environment["e"] == "empty":
        return "re"
    if cell["health"] < 45:
        return "d"
    if environment["e"] == "empty":
        return "me"
    return "d"`,
  EXPANDING_COLONY: `def action(cell, environment):
    if environment["n"] == "empty" and cell["health"] >= 50:
        return "rn"
    if environment["w"] == "enemy":
        return "aw"
    if environment["nw"] == "enemy":
        return "anw"
    if environment["n"] == "empty":
        return "mn"
    return "d"`,
  SENTINEL: `def action(cell, environment):
    if environment["n"] == "enemy":
        return "an"
    if environment["s"] == "enemy":
        return "as"
    if environment["e"] == "enemy":
        return "ae"
    if environment["w"] == "enemy":
        return "aw"
    if cell["health"] >= 50 and environment["e"] == "empty":
        return "re"
    return "d"`,
  RANDOM_EXPLORER: `def action(cell, environment):
    if environment["ne"] == "enemy":
        return "ane"
    if environment["se"] == "enemy":
        return "ase"
    if environment["s"] == "empty":
        return "ms"
    if cell["health"] >= 50 and environment["sw"] == "empty":
        return "rsw"
    return "d"`,
} as const;

export type TemplateName = keyof typeof CODE_TEMPLATES;
