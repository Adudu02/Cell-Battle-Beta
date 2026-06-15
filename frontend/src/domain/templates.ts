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
  AGGRESSIVE_STRESS: `def action(cell, environment):
    if environment["n"] == "enemy":
        return "an"
    if environment["s"] == "enemy":
        return "as"
    if environment["e"] == "enemy":
        return "ae"
    if environment["w"] == "enemy":
        return "aw"
    if environment["ne"] == "enemy":
        return "ane"
    if environment["nw"] == "enemy":
        return "anw"
    if environment["se"] == "enemy":
        return "ase"
    if environment["sw"] == "enemy":
        return "asw"

    if cell["health"] <= 1:
        return "d"

    if cell["health"] >= 50 and environment["n"] == "empty":
        return "rn"
    if cell["health"] >= 50 and environment["s"] == "empty":
        return "rs"
    if cell["health"] >= 50 and environment["e"] == "empty":
        return "re"
    if cell["health"] >= 50 and environment["w"] == "empty":
        return "rw"
    if cell["health"] >= 50 and environment["ne"] == "empty":
        return "rne"
    if cell["health"] >= 50 and environment["nw"] == "empty":
        return "rnw"
    if cell["health"] >= 50 and environment["se"] == "empty":
        return "rse"
    if cell["health"] >= 50 and environment["sw"] == "empty":
        return "rsw"

    return "d"`,
  CROWD_SURVIVAL_TRANSLATED: `def action(cell, environment):
    if cell["health"] <= 1:
        return "d"
    if environment["enemy_count"] > 3:
        if environment["first_enemy_direction"] == "n":
            return "an"
        if environment["first_enemy_direction"] == "s":
            return "as"
        if environment["first_enemy_direction"] == "e":
            return "ae"
        if environment["first_enemy_direction"] == "w":
            return "aw"
        if environment["first_enemy_direction"] == "ne":
            return "ane"
        if environment["first_enemy_direction"] == "nw":
            return "anw"
        if environment["first_enemy_direction"] == "se":
            return "ase"
        if environment["first_enemy_direction"] == "sw":
            return "asw"
    if cell["health"] >= 50 and environment["empty_count"] > 0:
        if environment["north_occupied_count"] <= environment["south_occupied_count"] and environment["north_occupied_count"] <= environment["east_occupied_count"] and environment["north_occupied_count"] <= environment["west_occupied_count"] and environment["n"] == "empty":
            return "rn"
        if environment["south_occupied_count"] <= environment["east_occupied_count"] and environment["south_occupied_count"] <= environment["west_occupied_count"] and environment["s"] == "empty":
            return "rs"
        if environment["east_occupied_count"] <= environment["west_occupied_count"] and environment["e"] == "empty":
            return "re"
        if environment["w"] == "empty":
            return "rw"
    if environment["n"] == "empty":
        return "mn"
    if environment["s"] == "empty":
        return "ms"
    if environment["e"] == "empty":
        return "me"
    if environment["w"] == "empty":
        return "mw"
    return "d"`,
} as const;

export type TemplateName = keyof typeof CODE_TEMPLATES;
