import { Model } from '@vuex-orm/core';
import Round from '~/models/round.model';
import Faceoff from '~/models/faceoff.model';
import Team from '~/models/team.model';
import Facility from '~/models/facility.model';
import { parseLeveradeDate } from '~/utils/utils';

export default class Match extends Model {
  static entity = 'matches';

  id!: string;
  datetime!: string | null;
  round_id!: string;
  round!: Round;
  faceoff_id!: string;
  faceoff!: Faceoff;
  home_team_id!: string;
  home_team!: Team;
  home_team_score!: number;
  away_team_id!: string;
  away_team!: Team;
  away_team_score!: number;
  periods!: {
    name?: string;
    order: number;
    home_team_score?: number;
    away_team_score?: number;
  }[];

  referees!: {
    first_name: string;
    last_name: string;
    gender: 'male' | 'female';
  }[];

  facility_id!: string;
  facility!: Facility | null;
  finished!: boolean;
  canceled!: boolean;
  rest!: boolean;

  // Non-Leverade fields:
  flickr_photoset_id?: string;

  static fields() {
    return {
      id: this.string(null),
      datetime: this.string(null).nullable(),
      round_id: this.string(null),
      round: this.belongsTo(Round, 'round_id'),
      faceoff_id: this.string(null).nullable(),
      faceoff: this.belongsTo(Faceoff, 'faceoff_id'),
      home_team_id: this.string(null).nullable(),
      home_team: this.belongsTo(Team, 'home_team_id'),
      home_team_score: this.number(null).nullable(),
      away_team_id: this.string(null).nullable(),
      away_team: this.belongsTo(Team, 'away_team_id'),
      away_team_score: this.number(null).nullable(),
      periods: this.attr([]),
      referees: this.attr([]),
      facility_id: this.string(null).nullable(),
      facility: this.belongsTo(Facility, 'facility_id'),
      finished: this.boolean(false),
      canceled: this.boolean(false),
      rest: this.boolean(false),

      // Non-Leverade fields:
      flickr_photoset_id: this.string(null).nullable(),
    };
  }

  parsedDate() {
    if (this.datetime) {
      return parseLeveradeDate(this.datetime);
    }
  }

  get homeTeamName(): string {
    if (this.home_team) {
      return this.home_team.name;
    } else if (this.faceoff?.first_text) {
      return this.faceoff.first_text;
    }
    return '';
  }

  get awayTeamName(): string {
    if (this.away_team) {
      return this.away_team.name;
    } else if (this.faceoff?.second_text) {
      return this.faceoff.second_text;
    }
    return '';
  }
}
