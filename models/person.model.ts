import { ManyItems } from '@directus/sdk';
import { Model } from '@vuex-orm/core';
import { DirectusPerson, getTranslatedFields } from '~/plugins/directus';
import Role from '~/models/role.model';
import RolePerson from '~/models/role-person.model';

export enum Gender {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export default class Person extends Model {
  static entity = 'people';

  id!: number;
  first_name!: string;
  last_name!: string;
  portrait_square_head?: string;
  gender!: Gender;
  email?: string;
  roles!: Role[];

  static fields() {
    return {
      id: this.number(null),
      first_name: this.string(null),
      last_name: this.string(null),
      portrait_square_head: this.string(null).nullable(),
      gender: this.string(Gender.Other),
      email: this.string(null).nullable(),
      roles: this.belongsToMany(Role, RolePerson, 'person_id', 'role_id'),
    };
  }

  /**
   * Inserts people as well as their roles and groups of the roles
   */
  static addManyFromDirectus(peopleResponse: ManyItems<DirectusPerson>) {
    if (!peopleResponse.data) {
      throw new Error('Error when retrieving people');
    }

    const people = peopleResponse.data.reduce((people, person) => {
      // We discard entries that don't have mandatory data.
      if (!person.id || !person.first_name || !person.last_name) {
        console.warn('Person missing mandatory data', { person });
        return people;
      }

      let roles: Role[] = [];
      if (person.roles) {
        roles = person.roles.reduce((roles, role) => {
          if (!role || !role.roles_id || !role.roles_id.id) {
            return roles;
          }

          const translatedRoleFields = getTranslatedFields(role.roles_id);

          if (!translatedRoleFields?.name) {
            return roles;
          }

          const translatedGroupFields = role.roles_id.group ? getTranslatedFields(role.roles_id.group) : {};

          return [
            ...roles,
            {
              id: role.roles_id.id,
              name: translatedRoleFields.name,
              name_feminine: translatedRoleFields.name_feminine,
              name_masculine: translatedRoleFields.name_masculine,
              group: role.roles_id.group
                ? {
                    id: role.roles_id.group.id,
                    name: translatedGroupFields?.name,
                    slug: translatedGroupFields?.slug,
                    description: translatedGroupFields?.description,
                  }
                : null,
              pivot: {
                main: role.main,
              },
            },
          ] as Role[];
        }, [] as Role[]);
      }

      return [
        ...people,
        {
          id: person.id,
          first_name: person.first_name,
          last_name: person.last_name,
          portrait_square_head: person.portrait_square_head,
          gender: person.gender,
          email: person.email,
          roles,
        },
      ];
    }, [] as any[]);

    this.insert({ data: people, insertOrUpdate: ['roles', 'groups'] });
  }
}
