import { useState, useEffect, useRef, useContext } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useLazyQuery } from '@apollo/client';

import Search from './Search/search.component';
import ColumnsBuilder from './columns';
import FavoritesService from '../../services/favorites.service';
import FavoritesContext from '../../contexts/favorites.context';
import IConnection from '../../interfaces/connection.interface';
import IConnectionVariables from '../../interfaces/connection-variables.interface';
import IColumnsBuilder from '../../interfaces/columns-builder.interface';
import { GET_ALL_PEOPLE } from '../../graphql/queries/people';
import * as styles from './characters-table.styles';

const DEFAULT_PAGE_SIZE: number = 10;

interface ICharactersTableProps {
  totalFans: number;
}

const CharactersTable: React.FC<ICharactersTableProps> = ({ totalFans }) => {
  const favoritesContext = useContext(FavoritesContext);
  const cursorsStack = useRef([] as string[]);
  const columns = useRef([] as GridColDef[]);
  const [currentPage, setPage] = useState(0);
  const [entities, setEntities] = useState({ edges: [], totalCount: 0 } as IConnection);
  const [getEntities, { loading, error, data, refetch }] = useLazyQuery(GET_ALL_PEOPLE, {
    fetchPolicy: 'no-cache',
    variables: {
      first: DEFAULT_PAGE_SIZE,
    } as IConnectionVariables
  });

  const updateColumns = () => {
    const columnsBuilderParams: IColumnsBuilder = {
      favorites: FavoritesService.getFavorites(),
      onFavorited: (cellParams: GridRenderCellParams) => {
        FavoritesService.favor(cellParams.row);
        columns.current = ColumnsBuilder({
          ...columnsBuilderParams,
          favorites: FavoritesService.getFavorites(),
        });
        favoritesContext?.updateStatistics();
      },
    }

    columns.current = ColumnsBuilder(columnsBuilderParams);
  }

  useEffect(() => {
    // get entities lazily as soon as component was mounted
    getEntities();
  }, []);

  useEffect(() => {
    // update columns to have all icons refreshed
    updateColumns();
    setEntities({ ...entities });
  }, [totalFans]);

  useEffect(() => {
    if (!data) {
      return;
    }

    // build data grid columns with the "Favorite" callback handler
    updateColumns();
    setEntities(data.allPeople);
  }, [data, favoritesContext]);

  const fetchData = () => {
    let variables = {
      first: DEFAULT_PAGE_SIZE,
      after: cursorsStack.current.length
        ? cursorsStack.current[cursorsStack.current.length - 1]
        : undefined,
    };

    refetch({ ...variables });
  }

  const pageChangeHandler = (page: number) => {
    // bi-directional pagination implementation using stack
    if (page < currentPage) {
      cursorsStack.current.pop();
    } else if (entities.pageInfo) {
      // if page >= current page and entities.pageInfo was presented
      cursorsStack.current.push(entities.pageInfo.endCursor);
    }

    fetchData();
    setPage(page);
  }

  // search by current page only,
  // swapi-graphql is missing search/filter functionality
  const searchHandler = (value: string) => {
    if (!value) {
      setEntities({
        ...entities,
        edges: data.allPeople.edges,
      });
      return;
    }

    // filter characters on the frontend side using current page results
    const result = data.allPeople.edges
      .filter(
        (edge: any) => edge.node.name
          .toLowerCase()
          .includes(value.toLowerCase().trim())
      );

    setEntities({
      ...entities,
      edges: result,
    });
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  const nodes = entities.edges.map((edge: any) => edge.node);
  return (
    <styles.Container>
      <Search onChange={searchHandler} debounce={300} />
      <DataGrid
        autoHeight
        rows={nodes}
        columns={columns.current}
        paginationMode="server"
        pageSize={DEFAULT_PAGE_SIZE}
        onPageChange={pageChangeHandler}
        rowCount={entities.totalCount}
        rowsPerPageOptions={[DEFAULT_PAGE_SIZE]}
        disableColumnMenu
        disableColumnSelector
        disableSelectionOnClick
      />
    </styles.Container>
  );
};

export default CharactersTable;
