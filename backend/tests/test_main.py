import unittest

from core import (
    OFFENSIVE_POSITIONS,
    get_weekly_puzzle_key,
    normalize_player,
    normalize_players,
    select_daily_player,
    select_weekly_player,
)


class BackendSmokeTests(unittest.TestCase):
    def test_normalize_player_drops_unknown_team(self) -> None:
        self.assertIsNone(
            normalize_player(
                {
                    "name": "Unknown Example",
                    "team": "XXX",
                    "position": "QB",
                    "jersey_number": 12,
                }
            )
        )

    def test_normalize_players_strips_extra_fields(self) -> None:
        players = normalize_players(
            [
                {
                    "full_name": "Case Example",
                    "team": "NYJ",
                    "position": "QB",
                    "jersey_number": "8",
                    "headshot": "https://example.com/headshot.png",
                }
            ]
        )

        self.assertEqual(len(players), 1)
        self.assertNotIn("headshot", players[0])
        self.assertEqual(players[0]["position"], "QB")

    def test_daily_selection_is_deterministic(self) -> None:
        sample_players = [
            {
                "name": "One Example",
                "team": "NYJ",
                "position": "QB",
                "jersey_number": 8,
                "conf": "AFC",
                "div": "East",
            },
            {
                "name": "Two Example",
                "team": "BUF",
                "position": "WR",
                "jersey_number": 14,
                "conf": "AFC",
                "div": "East",
            },
        ]

        first_pick = select_daily_player(sample_players, offense_only=False)
        second_pick = select_daily_player(sample_players, offense_only=False)

        self.assertEqual(first_pick, second_pick)
        self.assertIn(first_pick["position"], OFFENSIVE_POSITIONS)

    def test_weekly_selection_is_deterministic(self) -> None:
        sample_players = [
            {
                "name": "One Example",
                "team": "NYJ",
                "position": "QB",
                "jersey_number": 8,
                "conf": "AFC",
                "div": "East",
            },
            {
                "name": "Two Example",
                "team": "BUF",
                "position": "WR",
                "jersey_number": 14,
                "conf": "AFC",
                "div": "East",
            },
        ]

        first_pick = select_weekly_player(sample_players)
        second_pick = select_weekly_player(sample_players)

        self.assertEqual(first_pick, second_pick)
        self.assertRegex(get_weekly_puzzle_key(), r"^\d{4}-W\d{2}$")


if __name__ == "__main__":
    unittest.main()
