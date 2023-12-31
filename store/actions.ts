import { ActionTree } from 'vuex/types/index';
import { PartialItem } from '@directus/sdk';
import { Item } from '@vuex-orm/core';
import { EventTypes, MenuItem, PlayerPositions, RootState } from './state';
import {
  DirectusMatchAdditionalData,
  DirectusMenuItem,
  DirectusNationalCompetition,
  getTranslatedFields,
} from '~/plugins/directus';
import CompetitionEdition from '~/models/competition-edition.model';
import Round from '~/models/round.model';
import Match from '~/models/match.model';
import Facility from '~/models/facility.model';
import {
  LeveradeFaceoff,
  LeveradeFacility,
  LeveradeGroup,
  LeveradeMatch,
  LeveradePeriod,
  LeveradeProfile,
  LeveradeResult,
  LeveradeRound,
  LeveradeTeam,
  LeveradeTournament,
} from '~/plugins/leverade';
import Team from '~/models/team.model';
import Phase from '~/models/phase.model';
import Season from '~/models/season.model';
import Domain from '~/models/domain.model';
import ResourceType from '~/models/resource-type.model';
import Club from '~/models/club.model';
import Person from '~/models/person.model';
import Group from '~/models/group.model';
import Faceoff from '~/models/faceoff.model';
import { NationalCompetition, NationalCompetitionEdition } from '~/plugins/cms-service';
import LiveStream from '~/models/live-stream.model';

export default {
  async nuxtServerInit({ dispatch }) {
    await dispatch('loadMainMenu');
    await dispatch('loadSecondaryMenu');
    await dispatch('loadLiveStreams');
    await dispatch('loadSeasons');
    await dispatch('loadDomains');
  },
  async loadMainMenu({ commit }) {
    // TODO: Move logic to CMSService
    const locale = this.app.i18n.locale;

    const rawMainNavigation = await this.$directus.items('menus').readByQuery({
      filter: { parent: { _eq: 1 } },
      sort: ['sort'],
      deep: {
        // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
        translations: { _filter: { languages_code: { _eq: locale } } },
        // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
        children: { translations: { _filter: { languages_code: { _eq: locale } } } },
      },
      fields: [
        'translations.languages_code',
        'translations.name',
        'translations.href',
        'children.sort', // The API cannot sort in a relation yet. We do it ourselves.
        'children.translations.languages_code',
        'children.translations.name',
        'children.translations.href',
      ],
    });

    const transformForStore = (menuItem: PartialItem<DirectusMenuItem> | undefined): MenuItem => {
      const translatedFields = menuItem ? getTranslatedFields(menuItem) : undefined;

      let children: MenuItem[] = [];
      if (menuItem?.children) {
        children = menuItem.children
          .map(transformForStore)
          // We sort the children because the API can't do it yet (only at the root)
          .sort((childA, childB) => (childA.sort || 0) - (childB.sort || 0));
      }

      return {
        sort: menuItem?.sort || 0,
        name: translatedFields?.name || '',
        href: translatedFields?.href || '',
        children,
      };
    };

    const mainNavigation = rawMainNavigation.data?.map(transformForStore);

    commit('setMainNavigation', mainNavigation);
  },
  loadSecondaryMenu({ commit }) {
    const getSecondaryNavigationName = (key: string): string => {
      return this.$i18n.t(`footer.secondaryNavigation.${key}`).toString();
    };

    // TODO: Eventually move all the data to the CMS
    const secondaryNavigation: MenuItem[] = [
      {
        name: getSecondaryNavigationName('news'),
        href: 'news',
      },
      {
        name: getSecondaryNavigationName('photos'),
        href: 'https://flickr.com/swisstchoukball',
        isExternal: true,
      },
      {
        name: getSecondaryNavigationName('videos'),
        href: 'https://youtube.com/tchoukballch',
        isExternal: true,
      },
      {
        name: getSecondaryNavigationName('shop'),
        href: 'https://shop.tchoukball.ch',
        isExternal: true,
      },
      {
        name: getSecondaryNavigationName('contact'),
        href: 'contact',
      },
      {
        name: getSecondaryNavigationName('resources'),
        href: 'resources',
      },
      {
        name: getSecondaryNavigationName('medias'),
        href: 'medias',
      },
    ];

    commit('setSecondaryNavigation', secondaryNavigation);
  },
  async loadLiveStreams() {
    const directusLiveStreams = await this.$cmsService.getLiveStreams();
    LiveStream.insert({
      data: directusLiveStreams,
    });
  },
  async loadSeasons() {
    const directusSeasons = await this.$cmsService.getSeasons();
    Season.insert({
      data: directusSeasons,
    });
  },
  async loadDomains() {
    const domainsResponse = await this.$directus.items('domains').readByQuery({
      fields: ['id', 'translations.name'],
      // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
      deep: { translations: { _filter: { languages_code: { _eq: this.$i18n.locale } } } },
    });
    Domain.addManyFromDirectus(domainsResponse);
  },
  async loadGroups() {
    const groupsResponse = await this.$directus.items('groups').readByQuery({
      fields: ['id', 'translations.name', 'translations.description', 'translations.slug'],
      // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
      deep: { translations: { _filter: { languages_code: { _eq: this.$i18n.locale } } } },
    });
    await Group.addManyFromDirectus(groupsResponse);
  },
  async loadStaff(_context, { groupId, groupSlug }: { groupId: number; groupSlug: string }) {
    let filter: any = {};

    if (groupId) {
      filter = { roles: { roles_id: { group: { id: groupId } } } };
    } else if (groupSlug) {
      filter = { roles: { roles_id: { group: { translations: { slug: groupSlug } } } } };
    }

    const peopleResponse = await this.$directus.items('people').readByQuery({
      fields: [
        'id',
        'first_name',
        'last_name',
        'portrait_square_head',
        'gender',
        'email',
        'roles.main',
        'roles.roles_id.id',
        'roles.roles_id.translations.name',
        'roles.roles_id.translations.name_feminine',
        'roles.roles_id.translations.name_masculine',
        'roles.roles_id.group.id',
        'roles.roles_id.group.translations.name',
        'roles.roles_id.group.translations.slug',
        'roles.roles_id.group.translations.description',
      ],
      filter,
      deep: {
        roles: {
          // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
          roles_id: {
            translations: { _filter: { languages_code: { _eq: this.$i18n.locale } } },
            group: { translations: { _filter: { languages_code: { _eq: this.$i18n.locale } } } },
          },
        },
      },
    });
    Person.addManyFromDirectus(peopleResponse);
  },
  async loadResourceTypes() {
    const response = await this.$directus.items('resource_types').readByQuery({
      fields: ['id', 'translations.name'],
      // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
      deep: { translations: { _filter: { languages_code: { _eq: this.$i18n.locale } } } },
    });
    ResourceType.addManyFromDirectus(response);
  },
  async loadEventTypes({ commit }) {
    // TODO: Move logic to CMSService
    const locale = this.app.i18n.locale;

    const eventTypes = await this.$directus.items('event_types').readByQuery({
      deep: {
        // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
        translations: { _filter: { languages_code: { _eq: locale } } },
      },
      fields: [
        'id',
        'translations.languages_code',
        'translations.name',
        'translations.name_plural',
        'image.id',
        'image.description',
      ],
    });

    const types = eventTypes.data?.reduce((types, type) => {
      const translatedFields = getTranslatedFields(type);

      if (!type?.id || !translatedFields?.name || !translatedFields?.name_plural) {
        return types;
      }

      return {
        ...types,
        [type.id]: {
          id: type.id,
          name: translatedFields.name,
          name_plural: translatedFields.name_plural,
          image: type.image,
        },
      };
    }, {} as EventTypes);

    commit('setEventTypes', types);
  },
  async loadPlayerPositions({ commit }) {
    // TODO: Move logic to CMSService
    const locale = this.app.i18n.locale;

    const playerPositions = await this.$directus.items('player_positions').readByQuery({
      deep: {
        // @ts-ignore Bug with Directus SDK, which expects `filter` instead of `_filter`. It doesn't work with `filter`.
        translations: { _filter: { languages_code: { _eq: locale } } },
      },
      fields: [
        'id',
        'translations.languages_code',
        'translations.name',
        'translations.name_feminine',
        'translations.name_masculine',
      ],
    });

    const positions = playerPositions.data?.reduce((positions, position) => {
      const translatedFields = getTranslatedFields(position);

      if (!position?.id || !translatedFields?.name) {
        return positions;
      }

      return {
        ...positions,
        [position.id]: {
          id: position.id,
          name: translatedFields.name,
          name_feminine: translatedFields.name_feminine,
          name_masculine: translatedFields.name_masculine,
        },
      };
    }, {} as PlayerPositions);

    commit('setPlayerPositions', positions);
  },

  /**
   * Loads all the clubs and regional associations
   */
  async loadClubs() {
    const clubsResponse = await this.$directus.items('clubs').readByQuery({
      fields: ['id', 'name', 'name_full', 'name_sort', 'status', 'website', 'logo'],
      filter: {
        _or: [
          {
            status: 'passive',
          },
          {
            status: 'active',
          },
          {
            status: 'regional_association',
          },
        ],
      },
      sort: ['name_sort'],
    });
    Club.addManyFromDirectus(clubsResponse);
  },

  async insertFacilities(_context, facilities: LeveradeFacility[]) {
    await Facility.insert({
      data: facilities.map((facility) => {
        return {
          id: facility.id,
          name: facility.attributes.name,
          latitude: facility.attributes.latitude,
          longitude: facility.attributes.longitude,
          address: facility.attributes.address,
          postal_code: facility.attributes.postal_code,
          city: facility.attributes.city,
        };
      }),
    });
  },

  async insertMatches(
    _context,
    {
      matches,
      results,
      periods,
      referees,
    }: {
      matches: (LeveradeMatch & { additionalData?: DirectusMatchAdditionalData })[];
      results?: LeveradeResult[];
      periods?: LeveradePeriod[];
      referees?: LeveradeProfile[];
    }
  ) {
    await Match.insert({
      data: matches.map((match) => {
        let home_team_score: number | null = null;
        let away_team_score: number | null = null;
        let matchPeriods: Match['periods'] | undefined;
        let matchReferees: Match['referees'] | undefined;

        const homeResult = results?.find((result) => {
          return (
            result.relationships?.match?.data?.id === match.id &&
            result.relationships?.team?.data?.id === match.meta.home_team &&
            result.relationships?.parent?.data?.type === 'match'
          );
        });

        const awayResult = results?.find(
          (result) =>
            result.relationships?.match?.data?.id === match.id &&
            result.relationships?.team?.data?.id === match.meta.away_team &&
            result.relationships?.parent?.data?.type === 'match'
        );

        if (homeResult && awayResult) {
          home_team_score = homeResult.attributes.value;
          away_team_score = awayResult.attributes.value;
        }

        if (periods) {
          matchPeriods = periods
            .filter((period) => period.relationships?.periodable?.data?.id === match.id)
            .map((period) => {
              return {
                name: period.attributes.name,
                order: period.attributes.order,
                home_team_score:
                  results?.find(
                    (result) =>
                      result.relationships?.period?.data?.id === period.id &&
                      result.relationships?.team?.data?.id === match.meta.home_team
                  )?.attributes.value || undefined,
                away_team_score:
                  results?.find(
                    (result) =>
                      result.relationships?.period?.data?.id === period.id &&
                      result.relationships?.team?.data?.id === match.meta.away_team
                  )?.attributes.value || undefined,
              };
            });
        }

        if (referees) {
          matchReferees = referees.map((referee) => {
            return {
              first_name: referee.attributes.first_name,
              last_name: referee.attributes.last_name,
              gender: referee.attributes.gender,
            };
          });
        }

        return {
          id: match.id,
          datetime: match.attributes.datetime,
          home_team_id: match.meta.home_team,
          home_team_score,
          away_team_id: match.meta.away_team,
          away_team_score,
          periods: matchPeriods,
          referees: matchReferees,
          round_id: match.relationships.round.data.id,
          faceoff_id: match.relationships.faceoff.data ? match.relationships.faceoff.data.id : null,
          facility_id: match.relationships.facility.data ? match.relationships.facility.data.id : null,
          finished: match.attributes.finished,
          canceled: match.attributes.canceled,
          rest: match.attributes.rest,
          flickr_photoset_id: match.additionalData?.flickr_photoset_id,
        };
      }),
    });
  },

  async insertFaceoffs(_context, faceoffs: LeveradeFaceoff[]) {
    await Faceoff.insert({
      data: faceoffs.map((faceoff) => {
        return {
          id: faceoff.id,
          winner: faceoff.attributes.winner,
          first_team_id: faceoff.relationships.first_team.data ? faceoff.relationships.first_team.data.id : null,
          first_text: faceoff.attributes.first_text,
          second_team_id: faceoff.relationships.second_team.data ? faceoff.relationships.second_team.data.id : null,
          second_text: faceoff.attributes.second_text,
          round_id: faceoff.relationships.round.data.id,
        };
      }),
    });
  },

  async insertRounds(_context, rounds: LeveradeRound[]) {
    await Round.insert({
      data: rounds.map((round) => {
        return {
          id: round.id,
          name: round.attributes.name,
          start_date: round.attributes.start_date,
          end_date: round.attributes.end_date,
          order: round.attributes.order,
          phase_id: round.relationships.group.data.id,
        };
      }),
    });
  },

  async insertPhases(_context, groups: LeveradeGroup[]) {
    await Phase.insert({
      data: groups.map((group) => {
        return {
          id: group.id,
          name: group.attributes.name,
          order: group.attributes.order,
          type: group.attributes.type,
          group: group.attributes.group,
          competition_edition_id: group.relationships.tournament.data.id,
        };
      }),
    });
  },

  async insertTeams(_context, teams: LeveradeTeam[]) {
    await Team.insert({
      data: teams.map((team) => {
        const avatarKeyMatchArray = team.meta?.avatar?.large?.match(/\/(\w+)\.[0-9]/);

        return {
          id: team.id,
          name: team.attributes.name,
          avatarKey: avatarKeyMatchArray && avatarKeyMatchArray?.length > 1 ? avatarKeyMatchArray[1] : null,
          competition_edition_id: team.relationships.registrable.data.id,
        };
      }),
    });
  },

  async insertCompetitionEditions(
    _context,
    tournaments: (LeveradeTournament & { directus_id: number; competition?: DirectusNationalCompetition })[]
  ) {
    // We insertOrUpdate because we don't have the information from Directus and don't want to override it.
    await CompetitionEdition.insertOrUpdate({
      data: tournaments.map((tournament) => {
        const edition: any = {
          leverade_id: tournament.id,
          directus_id: tournament.directus_id,
          name: tournament.attributes.name,
          gender: tournament.attributes.gender,
          season_id: tournament.relationships.season.data.id,
        };

        // We do a separate check to not remove the competition_id in case
        // it set in the store and not provided in `tournament`
        if (tournament.competition) {
          edition.competition = tournament.competition;
        }

        return edition;
      }),
    });
  },

  async loadCompetitionsOfSeason(_context, seasonSlug: string) {
    let competitionEditions: NationalCompetitionEdition[] = [];
    try {
      competitionEditions = await this.$cmsService.getNationalCompetitionEditions({ seasonSlug });
    } catch (error) {
      console.error('Could not load the competitions for a season', error);
    }

    for (const competitionEdition of competitionEditions) {
      await CompetitionEdition.insert({
        data: {
          leverade_id: competitionEdition.leverade_id,
          directus_id: competitionEdition.directus_id,
          name: (competitionEdition.competition as NationalCompetition).name,
          season: competitionEdition.season,
          competition: competitionEdition.competition,
        },
      });
    }
  },

  async loadCompetitionEdition(
    context,
    { seasonSlug, competitionSlug }: { seasonSlug: string; competitionSlug: string }
  ) {
    const competitionEditions = await this.$cmsService.getNationalCompetitionEditions({ competitionSlug, seasonSlug });
    if (!competitionEditions || competitionEditions.length < 1) {
      throw new Error('No competition edition found');
    }
    // There should be only one edition matching the request parameters.
    if (competitionEditions.length > 1) {
      console.warn('Multiple competition editions matching the request. Taking the first one.');
    }
    const competitionEdition = competitionEditions[0];
    if (!competitionEdition.leverade_id) {
      throw new Error('This competition edition has no Leverade ID');
    }

    const tournamentResponse = await this.$leverade.getFullTournament(competitionEdition.leverade_id);
    const tournament = tournamentResponse.data.data;

    if (tournamentResponse.data.included) {
      const teams: LeveradeTeam[] = [];
      const groups: LeveradeGroup[] = [];
      const rounds: LeveradeRound[] = [];
      const faceoffs: LeveradeFaceoff[] = [];
      const matches: LeveradeMatch[] = [];
      const facilities: LeveradeFacility[] = [];
      const results: LeveradeResult[] = [];
      tournamentResponse.data.included.forEach((entity) => {
        switch (entity.type) {
          case 'team':
            teams.push(entity);
            break;
          case 'group':
            groups.push(entity);
            break;
          case 'round':
            rounds.push(entity);
            break;
          case 'faceoff':
            faceoffs.push(entity);
            break;
          case 'match':
            matches.push(entity);
            break;
          case 'facility':
            facilities.push(entity);
            break;
          case 'result': {
            results.push(entity);
            break;
          }
          default:
        }
      });

      await CompetitionEdition.insert({
        data: {
          leverade_id: tournament.id,
          directus_id: competitionEdition.directus_id,
          name: tournament.attributes.name,
          gender: tournament.attributes.gender,
          season: competitionEdition.season,
          competition: competitionEdition.competition,
          teams: teams.map((team) => {
            const avatarKeyMatchArray = team.meta?.avatar?.large?.match(/\/(\w+)\.[0-9]/);

            return {
              id: team.id,
              name: team.attributes.name,
              avatarKey: avatarKeyMatchArray && avatarKeyMatchArray?.length > 1 ? avatarKeyMatchArray[1] : null,
            };
          }),
          phases: groups.map((group) => {
            return {
              id: group.id,
              name: group.attributes.name,
              order: group.attributes.order,
              type: group.attributes.type,
              group: group.attributes.group,
            };
          }),
        },
      });

      await context.dispatch('insertFacilities', facilities);
      await context.dispatch('insertRounds', rounds);
      await context.dispatch('insertFaceoffs', faceoffs);
      await context.dispatch('insertMatches', { matches, results });
      context.commit('setCompetitionEditionAsFullyLoaded', { seasonSlug, competitionSlug });
    }
  },

  async loadMatch(context, matchId) {
    const matchResponse = await this.$leverade.getMatch(matchId);

    if (!matchResponse.data.included) {
      throw new Error('Missing related match data');
    }

    const teams: LeveradeTeam[] = [];
    let faceoff: LeveradeFaceoff | undefined;
    let round: LeveradeRound | undefined;
    let group: LeveradeGroup | undefined;
    let tournament: LeveradeTournament | undefined;
    let facility: LeveradeFacility | undefined;
    const results: LeveradeResult[] = [];
    const periods: LeveradePeriod[] = [];
    const referees: LeveradeProfile[] = [];
    matchResponse.data.included.forEach((entity) => {
      switch (entity.type) {
        case 'team':
          teams.push(entity);
          break;
        case 'faceoff':
          faceoff = entity;
          break;
        case 'round':
          round = entity;
          break;
        case 'group':
          group = entity;
          break;
        case 'tournament':
          tournament = entity;
          break;
        case 'facility':
          facility = entity;
          break;
        case 'result':
          results.push(entity);
          break;
        case 'period':
          periods.push(entity);
          break;
        case 'profile':
          // For now it's fine to do this because the only profiles we get for a match are referees.
          // If later one we retrieve the players, then we'll have to add more logic to differentiate them.
          referees.push(entity);
          break;
        default:
      }
    });

    const match = matchResponse.data.data;

    // Loading additional data from Directus
    const matchAdditionalData = await this.$cmsService.getMatchAdditionalData(matchId);

    if (facility) {
      await context.dispatch('insertFacilities', [facility]);
    }

    if (tournament) {
      // Loading Directus-only data
      const competitionEditions = await this.$cmsService.getNationalCompetitionEditions({
        leveradeIds: [tournament.id],
      });
      // There should be only one edition matching the request parameters.
      if (competitionEditions.length > 1) {
        console.warn('Multiple competition editions matching the request. Taking the first one.');
      }
      const competitionEdition = competitionEditions[0];
      await context.dispatch('insertCompetitionEditions', [
        {
          ...tournament,
          directus_id: competitionEdition.directus_id,
          competition: competitionEdition.competition,
        },
      ]);
    }

    if (group) {
      await context.dispatch('insertPhases', [group]);
    }

    if (round) {
      await context.dispatch('insertRounds', [round]);
    }

    if (faceoff) {
      await context.dispatch('insertFaceoffs', [faceoff]);
    }

    await context.dispatch('insertTeams', teams);
    await context.dispatch('insertMatches', {
      matches: [{ ...match, additionalData: matchAdditionalData }],
      results,
      periods,
      referees,
    });
  },

  async loadUpcomingMatches(context) {
    const currentSeason: Item<Season> = context.getters.currentSeason;
    if (!currentSeason) {
      throw new Error('Current season undefined');
    }

    const matchesResponse = await this.$leverade.getUpcomingMatches(currentSeason.leverade_id);
    const matches = matchesResponse.data.data;

    if (!matchesResponse.data?.included) {
      // No data for upcoming matches
      context.commit('setUpcomingMatchesAsLoaded');
      return;
    }

    const teams: LeveradeTeam[] = [];
    const groups: LeveradeGroup[] = [];
    const rounds: LeveradeRound[] = [];
    const tournaments: LeveradeTournament[] = [];
    const facilities: LeveradeFacility[] = [];
    matchesResponse.data.included.forEach((entity) => {
      switch (entity.type) {
        case 'team':
          teams.push(entity);
          break;
        case 'group':
          groups.push(entity);
          break;
        case 'round':
          rounds.push(entity);
          break;
        case 'tournament':
          tournaments.push(entity);
          break;
        case 'facility':
          facilities.push(entity);
          break;
        default:
      }
    });

    // Loading Directus-only data
    const competitionEditions = await this.$cmsService.getNationalCompetitionEditions({
      leveradeIds: tournaments.map((tournament) => tournament.id),
    });

    const tournamentsWithCompetition = tournaments.map((tournament) => {
      const edition = competitionEditions.find((edition) => edition.leverade_id?.toString() === tournament.id);
      if (!edition) {
        return tournament;
      }
      return {
        ...tournament,
        directus_id: edition.directus_id,
        competition: edition.competition,
      };
    });

    await context.dispatch('insertFacilities', facilities);
    await context.dispatch('insertCompetitionEditions', tournamentsWithCompetition);
    await context.dispatch('insertTeams', teams);
    await context.dispatch('insertPhases', groups);
    await context.dispatch('insertRounds', rounds);
    await context.dispatch('insertMatches', { matches });
    context.commit('setUpcomingMatchesAsLoaded');
  },
} as ActionTree<RootState, RootState>;
